-- =====================================================================
-- RadioPass payments and timed access.
--
-- Run in the Supabase SQL Editor AFTER permissions.sql (it uses
-- has_capability). Idempotent — safe to re-run.
--
-- THE ONE IDEA THIS FILE IS BUILT AROUND: access is a LEDGER, not a
-- field. Every grant of access is a row saying where it came from, when
-- it starts and when it ends. "Does this person have paid access?" is
-- then a question about rows and dates, answered here, in UTC, from
-- verified state — never from anything a browser said.
--
-- Setting a single expires_at column would have been shorter and is
-- wrong: a refund must be able to withdraw ONE payment without
-- destroying a later purchase or a complimentary grant that overlaps
-- it. A ledger can express that; a column cannot.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Plans. Stable internal ids, Stripe ids alongside.
--
-- The internal id is what the rest of the system speaks. Stripe prices
-- are references, so a price can be changed, or a product re-created,
-- without a single line of access logic moving.
-- ---------------------------------------------------------------------
create table if not exists public.plans (
  id                text primary key,           -- 'premium_3m'
  name              text not null,              -- '3 months'
  months            integer not null check (months > 0),
  amount_pence      integer not null check (amount_pence >= 0),
  currency          text not null default 'gbp',
  stripe_price_id   text unique,                -- null until created in Stripe
  branch            text not null default 'full'
                    check (branch in ('full','anatomy','physics')),
  active            boolean not null default true,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.plans is
  'What can be bought. Prices change here; access logic never moves.';

insert into public.plans (id, name, months, amount_pence, stripe_price_id, sort_order)
values
  ('premium_3m',  '3 months',  3,  4900, null, 1),
  ('premium_6m',  '6 months',  6,  8900, null, 2),
  ('premium_12m', '12 months', 12, 14900, null, 3)
on conflict (id) do nothing;

-- Anyone may read the plan list — it is the pricing page.
alter table public.plans enable row level security;
drop policy if exists "plans are public" on public.plans;
create policy "plans are public" on public.plans for select to anon, authenticated using (active);
drop policy if exists "owners write plans" on public.plans;
create policy "owners write plans" on public.plans for all to authenticated
  using (public.has_capability('users:manage')) with check (public.has_capability('users:manage'));

-- ---------------------------------------------------------------------
-- 2. Stripe customer, tied to the Supabase user id.
--
-- Not to the email address. People change emails, and two Stripe
-- customers can share one; the account id is the only thing that is
-- durably the same person.
-- ---------------------------------------------------------------------
create table if not exists public.stripe_customers (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at         timestamptz not null default now()
);

alter table public.stripe_customers enable row level security;
drop policy if exists "read own stripe customer" on public.stripe_customers;
create policy "read own stripe customer" on public.stripe_customers
  for select to authenticated using (user_id = auth.uid());
-- No insert/update policy at all: only the service role writes here.

-- ---------------------------------------------------------------------
-- 3. Payments. One row per Stripe payment, whatever became of it.
-- ---------------------------------------------------------------------
create table if not exists public.payments (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null references auth.users(id) on delete cascade,
  plan_id                   text references public.plans(id),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id  text unique,
  stripe_customer_id        text,
  amount_pence              integer,
  currency                  text default 'gbp',
  status                    text not null default 'paid'
                            check (status in ('paid','refunded','partially_refunded','failed','disputed')),
  refunded_at               timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index if not exists payments_user on public.payments(user_id);

alter table public.payments enable row level security;
drop policy if exists "read own payments" on public.payments;
create policy "read own payments" on public.payments
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "managers read payments" on public.payments;
create policy "managers read payments" on public.payments
  for select to authenticated using (public.has_capability('users:manage'));
-- Again: no write policy. Payments are written by the webhook only.

-- ---------------------------------------------------------------------
-- 4. The ledger. Every grant of access, with its origin.
--
-- source is what keeps complimentary access honest: it is a real row
-- with a real reason, never a faked Stripe payment. It is also what
-- lets the analytics separate revenue from goodwill.
-- ---------------------------------------------------------------------
create table if not exists public.access_grants (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  source      text not null check (source in ('stripe','complimentary','beta','staff','migration')),
  plan_id     text references public.plans(id),
  branch      text not null default 'full' check (branch in ('full','anatomy','physics')),
  starts_at   timestamptz not null default now(),
  expires_at  timestamptz,                       -- null = does not expire
  status      text not null default 'active' check (status in ('active','revoked','refunded')),
  payment_id  uuid references public.payments(id) on delete set null,
  note        text,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists access_grants_user_live
  on public.access_grants(user_id, expires_at) where status = 'active';

alter table public.access_grants enable row level security;
drop policy if exists "read own access" on public.access_grants;
create policy "read own access" on public.access_grants
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "managers read access" on public.access_grants;
create policy "managers read access" on public.access_grants
  for select to authenticated using (public.has_capability('users:manage'));
-- Deliberately NO insert/update/delete policy for anybody, including
-- managers. Every mutation goes through the SECURITY DEFINER functions
-- below, so each one is audited and each one is checked. A manager with
-- a direct UPDATE could set an expiry with no record of why.

-- ---------------------------------------------------------------------
-- 5. Idempotency. A Stripe event is processed at most once, ever.
-- ---------------------------------------------------------------------
create table if not exists public.stripe_events (
  id            text primary key,        -- Stripe's evt_...
  type          text not null,
  payload       jsonb,
  processed_at  timestamptz not null default now(),
  error         text
);

alter table public.stripe_events enable row level security;
drop policy if exists "managers read stripe events" on public.stripe_events;
create policy "managers read stripe events" on public.stripe_events
  for select to authenticated using (public.has_capability('users:manage'));

-- ---------------------------------------------------------------------
-- 6. The audit trail for manual adjustments.
-- ---------------------------------------------------------------------
create table if not exists public.access_audit (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  actor_id    uuid references auth.users(id),
  action      text not null,
  detail      jsonb,
  note        text,
  created_at  timestamptz not null default now()
);

alter table public.access_audit enable row level security;
drop policy if exists "managers read access audit" on public.access_audit;
create policy "managers read access audit" on public.access_audit
  for select to authenticated using (public.has_capability('users:manage'));

-- =====================================================================
-- 7. THE AUTHORITATIVE ANSWER.
--
-- Everything above exists so these two functions can be trusted. They
-- read rows and compare dates in UTC. No cron job turns anybody off at
-- midnight: an expiry in the past simply stops matching.
-- =====================================================================

-- When does this person's paid access run out? NULL = no paid access.
-- A grant with a NULL expires_at never expires, and 'infinity' makes it
-- sort above every real date so it wins the max() correctly.
create or replace function public.paid_access_until(uid uuid default auth.uid())
returns timestamptz
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select nullif(max(coalesce(g.expires_at, 'infinity'::timestamptz)), '-infinity'::timestamptz)
  from public.access_grants g
  where g.user_id = uid
    and g.status = 'active'
    and g.starts_at <= now()
    and (g.expires_at is null or g.expires_at > now())
$$;

create or replace function public.has_paid_access(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.paid_access_until(uid) is not null
$$;

grant execute on function public.paid_access_until(uuid) to authenticated;
grant execute on function public.has_paid_access(uuid) to authenticated;

-- What the app reads on sign-in: grants, and when they lapse.
-- SECURITY DEFINER so it can see the ledger, but it only ever answers
-- about auth.uid() unless the caller may manage users.
create or replace function public.my_access()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  until timestamptz;
  g     jsonb;
  row_  record;
begin
  until := public.paid_access_until(auth.uid());

  select into row_
    ag.branch, ag.source, ag.plan_id, ag.starts_at, ag.expires_at, p.name as plan_name
  from public.access_grants ag
  left join public.plans p on p.id = ag.plan_id
  where ag.user_id = auth.uid()
    and ag.status = 'active'
    and ag.starts_at <= now()
    and (ag.expires_at is null or ag.expires_at > now())
  order by coalesce(ag.expires_at, 'infinity'::timestamptz) desc
  limit 1;

  -- 'account' always; the paid branch only while a grant is live. This is
  -- the whole of "expired falls back to free" — nothing is deleted, the
  -- row simply stops matching.
  g := case when until is null then '["account"]'::jsonb
            else jsonb_build_array('account', coalesce(row_.branch, 'full')) end;

  return jsonb_build_object(
    'grants',      g,
    'paid',        until is not null,
    'expires_at',  until,
    'source',      row_.source,
    'plan_id',     row_.plan_id,
    'plan_name',   row_.plan_name,
    'starts_at',   row_.starts_at,
    'server_time', now()
  );
end;
$$;

grant execute on function public.my_access() to authenticated;

-- =====================================================================
-- 8. MUTATIONS. Every change to access happens through one of these.
--
-- The tables have no write policies, so these SECURITY DEFINER
-- functions are the only way in. That is what makes the audit trail
-- complete: there is no path that bypasses it.
-- =====================================================================

-- Apply a confirmed Stripe payment. Called ONLY by the webhook Edge
-- Function, with the service role.
--
-- IDEMPOTENT BY CONSTRUCTION. The first statement inserts the Stripe
-- event id as a primary key. A replayed webhook collides, the insert
-- reports zero rows, and the function returns having done nothing. It
-- is not "check then act" — the uniqueness constraint IS the check, so
-- two webhooks arriving at the same instant cannot both pass it.
create or replace function public.apply_stripe_purchase(
  p_event_id        text,
  p_user_id         uuid,
  p_plan_id         text,
  p_session_id      text default null,
  p_payment_intent  text default null,
  p_customer_id     text default null,
  p_amount_pence    integer default null,
  p_currency        text default 'gbp'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_months   integer;
  v_branch   text;
  v_base     timestamptz;
  v_expires  timestamptz;
  v_payment  uuid;
  v_inserted integer;
begin
  insert into public.stripe_events (id, type)
  values (p_event_id, 'purchase')
  on conflict (id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return jsonb_build_object('status', 'already_processed', 'event_id', p_event_id);
  end if;

  select months, branch into v_months, v_branch from public.plans where id = p_plan_id;
  if v_months is null then
    raise exception 'Unknown plan %', p_plan_id;
  end if;

  insert into public.payments (
    user_id, plan_id, stripe_checkout_session_id, stripe_payment_intent_id,
    stripe_customer_id, amount_pence, currency, status
  ) values (
    p_user_id, p_plan_id, p_session_id, p_payment_intent,
    p_customer_id, p_amount_pence, p_currency, 'paid'
  )
  on conflict (stripe_payment_intent_id) do update set updated_at = now()
  returning id into v_payment;

  -- THE RENEWAL RULE. Extend from whichever is later: now, or the time
  -- their current access runs out. Buying in November with access until
  -- December must not throw the December away.
  v_base := greatest(now(), coalesce(public.paid_access_until(p_user_id), now()));
  v_expires := v_base + make_interval(months => v_months);

  insert into public.access_grants (
    user_id, source, plan_id, branch, starts_at, expires_at, status, payment_id
  ) values (
    p_user_id, 'stripe', p_plan_id, coalesce(v_branch,'full'), now(), v_expires, 'active', v_payment
  );

  insert into public.access_audit (user_id, actor_id, action, detail)
  values (p_user_id, null, 'stripe_purchase',
          jsonb_build_object('plan', p_plan_id, 'expires_at', v_expires, 'event', p_event_id));

  return jsonb_build_object('status','applied','expires_at',v_expires,'plan',p_plan_id);
end;
$$;

revoke all on function public.apply_stripe_purchase(text,uuid,text,text,text,text,integer,text)
  from public, anon, authenticated;

-- A refund withdraws the grant that payment bought, and nothing else.
-- Deliberately NOT `expires_at = now()` on the person: a later purchase
-- or a complimentary grant must survive somebody being refunded for an
-- earlier one. That is the reason access is a ledger.
create or replace function public.record_stripe_refund(
  p_event_id       text,
  p_payment_intent text,
  p_full           boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment uuid;
  v_user    uuid;
  v_rows    integer;
begin
  insert into public.stripe_events (id, type) values (p_event_id, 'refund')
  on conflict (id) do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    return jsonb_build_object('status','already_processed');
  end if;

  select id, user_id into v_payment, v_user
  from public.payments where stripe_payment_intent_id = p_payment_intent;
  if v_payment is null then
    return jsonb_build_object('status','payment_not_found');
  end if;

  update public.payments
  set status = case when p_full then 'refunded' else 'partially_refunded' end,
      refunded_at = now(), updated_at = now()
  where id = v_payment;

  -- Only a FULL refund withdraws access. A partial refund is recorded
  -- and left for a human: the system cannot know what fraction of time
  -- was meant to be returned, and guessing would take access away that
  -- somebody paid for.
  if p_full then
    update public.access_grants
    set status = 'refunded', updated_at = now()
    where payment_id = v_payment and status = 'active';
  end if;

  insert into public.access_audit (user_id, actor_id, action, detail)
  values (v_user, null, case when p_full then 'refund_full' else 'refund_partial' end,
          jsonb_build_object('payment_intent', p_payment_intent, 'event', p_event_id));

  return jsonb_build_object('status','refunded','full',p_full);
end;
$$;

revoke all on function public.record_stripe_refund(text,text,boolean) from public, anon, authenticated;

-- Complimentary access. A real grant with a real reason — never a faked
-- payment, so revenue reporting stays honest and the recipient's row
-- says plainly where their access came from.
create or replace function public.grant_complimentary_access(
  p_user_id uuid,
  p_months  integer,
  p_note    text,
  p_source  text default 'complimentary',
  p_branch  text default 'full'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_base    timestamptz;
  v_expires timestamptz;
begin
  if not public.has_capability('users:manage') then
    raise exception 'Not permitted' using errcode = '42501';
  end if;
  if p_source not in ('complimentary','beta','staff') then
    raise exception 'Complimentary access cannot be recorded as %', p_source;
  end if;
  if coalesce(trim(p_note),'') = '' then
    raise exception 'A reason is required for manual access';
  end if;

  v_base := greatest(now(), coalesce(public.paid_access_until(p_user_id), now()));
  v_expires := case when p_months is null then null
                    else v_base + make_interval(months => p_months) end;

  insert into public.access_grants (
    user_id, source, branch, starts_at, expires_at, status, note, created_by
  ) values (
    p_user_id, p_source, p_branch, now(), v_expires, 'active', p_note, auth.uid()
  );

  insert into public.access_audit (user_id, actor_id, action, detail, note)
  values (p_user_id, auth.uid(), 'grant_' || p_source,
          jsonb_build_object('months', p_months, 'expires_at', v_expires), p_note);

  return jsonb_build_object('status','granted','expires_at',v_expires);
end;
$$;

grant execute on function public.grant_complimentary_access(uuid,integer,text,text,text) to authenticated;

-- Withdraw access. Revokes live grants; the ledger keeps them, so the
-- history of what somebody had is never lost.
create or replace function public.revoke_access(p_user_id uuid, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_n integer;
begin
  if not public.has_capability('users:manage') then
    raise exception 'Not permitted' using errcode = '42501';
  end if;
  if coalesce(trim(p_note),'') = '' then
    raise exception 'A reason is required to revoke access';
  end if;

  update public.access_grants
  set status = 'revoked', updated_at = now()
  where user_id = p_user_id and status = 'active';
  get diagnostics v_n = row_count;

  insert into public.access_audit (user_id, actor_id, action, detail, note)
  values (p_user_id, auth.uid(), 'revoke', jsonb_build_object('grants_revoked', v_n), p_note);

  return jsonb_build_object('status','revoked','grants',v_n);
end;
$$;

grant execute on function public.revoke_access(uuid,text) to authenticated;
