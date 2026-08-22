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
  id                text primary key,           -- 'free', 'premium_3m'
  name              text not null,
  -- NULL months means "does not expire". That is what makes `free` a real
  -- plan rather than the absence of one: a free account is a state somebody
  -- is permanently in, not a gap between purchases.
  months            integer check (months is null or months > 0),
  amount_pence      integer not null default 0 check (amount_pence >= 0),
  currency          text not null default 'gbp',
  -- The CURRENT Stripe price. History lives in plan_prices, because a price
  -- that has ever been charged must remain resolvable for old transactions.
  stripe_price_id   text unique,
  branch            text not null default 'full'
                    check (branch in ('full','anatomy','physics')),
  -- Free is a real plan and is shown on the pricing page, but it is not
  -- bought, so it never needs a Stripe price and must never reach checkout.
  purchasable       boolean not null default true,
  active            boolean not null default true,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.plans is
  'What can be held. Prices change through set_plan_price(); access logic never moves.';

-- THE PRICES THAT ALREADY EXISTED, carried over rather than invented.
-- The site showed £0, £29 and £49; those are the numbers seeded here. The
-- twelve-month slot has no price because the old pricing had no third paid
-- figure, and guessing one would be inventing a business decision.
--
-- Nothing can be sold at a seeded number anyway: create-checkout-session
-- refuses a plan whose stripe_price_id is null, and only Pricing Management
-- sets that. So these are display values until the owner confirms each price,
-- and no customer can be charged an amount nobody chose.
insert into public.plans (id, name, months, amount_pence, purchasable, sort_order)
values
  ('free',        'Free',      null, 0,    false, 0),
  ('premium_3m',  '3 months',  3,    2900, true,  1),
  ('premium_6m',  '6 months',  6,    4900, true,  2),
  ('premium_12m', '12 months', 12,   0,    true,  3)
on conflict (id) do nothing;

-- Every price this plan has ever had. Kept because a refund, a receipt or a
-- question about an old charge has to resolve the price that was actually
-- charged — which is not necessarily the one on sale today.
create table if not exists public.plan_prices (
  id               uuid primary key default gen_random_uuid(),
  plan_id          text not null references public.plans(id) on delete cascade,
  stripe_price_id  text not null unique,
  amount_pence     integer not null check (amount_pence >= 0),
  currency         text not null default 'gbp',
  active           boolean not null default true,
  created_by       uuid references auth.users(id),
  created_at       timestamptz not null default now()
);

create index if not exists plan_prices_plan on public.plan_prices(plan_id, active);

alter table public.plan_prices enable row level security;
drop policy if exists "managers read plan prices" on public.plan_prices;
create policy "managers read plan prices" on public.plan_prices
  for select to authenticated using (public.has_capability('users:manage'));

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

-- =====================================================================
-- 9. Changing a price, without anybody copying an id.
--
-- The Edge Function creates the Stripe Price (that needs the secret key,
-- so it cannot happen here) and then calls this to make it the live one.
-- Stripe prices are immutable by design, so a change is always a NEW
-- price; the old row stays, inactive, because an old charge has to stay
-- resolvable.
-- =====================================================================
create or replace function public.record_plan_price(
  p_plan_id     text,
  p_price_id    text,
  p_amount      integer,
  p_currency    text default 'gbp',
  p_actor       uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_old text;
begin
  select stripe_price_id into v_old from public.plans where id = p_plan_id;
  if not found then raise exception 'Unknown plan %', p_plan_id; end if;

  update public.plan_prices set active = false where plan_id = p_plan_id and active;

  insert into public.plan_prices (plan_id, stripe_price_id, amount_pence, currency, created_by)
  values (p_plan_id, p_price_id, p_amount, p_currency, p_actor);

  update public.plans
  set stripe_price_id = p_price_id, amount_pence = p_amount,
      currency = p_currency, updated_at = now()
  where id = p_plan_id;

  insert into public.access_audit (user_id, actor_id, action, detail, note)
  values (coalesce(p_actor, '00000000-0000-0000-0000-000000000000'::uuid), p_actor,
          'price_change',
          jsonb_build_object('plan', p_plan_id, 'from_price', v_old,
                             'to_price', p_price_id, 'amount_pence', p_amount),
          'Price changed via Pricing Management');

  return jsonb_build_object('status','ok','plan',p_plan_id,'price',p_price_id,'amount_pence',p_amount);
end;
$$;

revoke all on function public.record_plan_price(text,text,integer,text,uuid) from public, anon, authenticated;

-- A plan that is not purchasable must never produce a grant. `free` is a
-- state somebody is in, not something a webhook can award, and a bug that
-- let it through would hand out access for a payment of nothing.
create or replace function public.assert_purchasable() returns trigger
language plpgsql as $$
begin
  if new.source = 'stripe' and new.plan_id is not null then
    if not exists (select 1 from public.plans where id = new.plan_id and purchasable) then
      raise exception 'Plan % is not purchasable', new.plan_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists access_grants_purchasable on public.access_grants;
create trigger access_grants_purchasable
  before insert on public.access_grants
  for each row execute function public.assert_purchasable();

-- What the pricing page reads. Public, and deliberately narrow: the price
-- list is not a place to learn anything about Stripe.
create or replace function public.public_plans()
returns table (id text, name text, months integer, amount_pence integer,
               currency text, purchasable boolean, sort_order integer)
language sql stable
set search_path = public, pg_temp
as $$
  select id, name, months, amount_pence, currency, purchasable, sort_order
  from public.plans where active order by sort_order
$$;

grant execute on function public.public_plans() to anon, authenticated;

-- =====================================================================
-- 10. Owner-facing lookups.
--
-- Search returns a SUMMARY per person, never a dump of the user table:
-- an admin screen needs enough to act on, and every extra field is one
-- more thing to leak. The query is required — an empty search must not
-- page through every candidate you have.
-- =====================================================================
create or replace function public.admin_find_users(p_query text, p_limit integer default 25)
returns table (
  user_id      uuid,
  email        text,
  created_at   timestamptz,
  role         text,
  paid         boolean,
  expires_at   timestamptz,
  source       text,
  plan_id      text,
  plan_name    text,
  lifetime_pence bigint
)
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if not public.has_capability('users:manage') then
    raise exception 'Not permitted' using errcode = '42501';
  end if;
  if coalesce(trim(p_query),'') = '' then
    raise exception 'Type at least part of an email address';
  end if;

  return query
  select
    u.id,
    u.email::text,
    u.created_at,
    e.role,
    public.has_paid_access(u.id),
    public.paid_access_until(u.id),
    live.source,
    live.plan_id,
    pl.name,
    -- Only PAID payments count toward what somebody has spent. A refunded
    -- charge in this total would misreport both the customer and revenue.
    coalesce((select sum(p.amount_pence) from public.payments p
              where p.user_id = u.id and p.status = 'paid'), 0)::bigint
  from auth.users u
  left join public.entitlements e on e.user_id = u.id
  left join lateral (
    select ag.source, ag.plan_id
    from public.access_grants ag
    where ag.user_id = u.id and ag.status = 'active'
      and (ag.expires_at is null or ag.expires_at > now())
    order by coalesce(ag.expires_at, 'infinity'::timestamptz) desc
    limit 1
  ) live on true
  left join public.plans pl on pl.id = live.plan_id
  where u.email ilike '%' || p_query || '%'
  order by u.created_at desc
  limit least(coalesce(p_limit, 25), 100);
end;
$$;

grant execute on function public.admin_find_users(text,integer) to authenticated;

-- Everything that has been done to one person's access, newest first.
create or replace function public.admin_user_history(p_user_id uuid)
returns table (created_at timestamptz, action text, note text, detail jsonb, actor_email text)
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if not public.has_capability('users:manage') then
    raise exception 'Not permitted' using errcode = '42501';
  end if;
  return query
  select a.created_at, a.action, a.note, a.detail, au.email::text
  from public.access_audit a
  left join auth.users au on au.id = a.actor_id
  where a.user_id = p_user_id
  order by a.created_at desc
  limit 100;
end;
$$;

grant execute on function public.admin_user_history(uuid) to authenticated;

-- Revenue, kept honest. Complimentary, beta and staff grants are counted
-- SEPARATELY and never as income — mixing goodwill into revenue is how a
-- business talks itself into believing a launch went better than it did.
create or replace function public.owner_revenue()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.has_capability('users:manage') then
    raise exception 'Not permitted' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'by_plan', coalesce((
        select jsonb_object_agg(plan_id, jsonb_build_object('count', n, 'pence', pence))
        from (select p.plan_id, count(*) n, sum(p.amount_pence) pence
              from public.payments p where p.status = 'paid'
              group by p.plan_id) t), '{}'::jsonb),
      'total_pence', coalesce((select sum(amount_pence) from public.payments where status='paid'),0),
      'refunded_pence', coalesce((select sum(amount_pence) from public.payments where status='refunded'),0),
      'paying_now', (select count(distinct g.user_id) from public.access_grants g
                      where g.source='stripe' and g.status='active'
                        and (g.expires_at is null or g.expires_at > now())),
      'expired_paid', (select count(distinct g.user_id) from public.access_grants g
                        where g.source='stripe'
                          and g.user_id not in (
                            select user_id from public.access_grants
                            where status='active' and (expires_at is null or expires_at > now()))),
      'complimentary_now', (select count(distinct g.user_id) from public.access_grants g
                             where g.source in ('complimentary','beta','staff') and g.status='active'
                               and (g.expires_at is null or g.expires_at > now())),
      'renewals', (select count(*) from public.payments p where p.status='paid'
                    and exists (select 1 from public.payments q
                                where q.user_id=p.user_id and q.created_at < p.created_at))
    )
  );
end;
$$;

grant execute on function public.owner_revenue() to authenticated;

-- =====================================================================
-- 11. Where premium content actually lives.
--
-- The point of this table is what it does NOT have: any policy at all.
-- RLS is enabled and no policy grants anybody anything, so an
-- authenticated browser querying it directly gets an empty result, every
-- time, no matter what it claims about itself. The ONLY reader is the
-- premium-content Edge Function, using the service role, and only after
-- has_paid_access() has answered true.
--
-- This is the fix for premium material being compiled into the bundle:
-- what is sold is not shipped.
-- =====================================================================
create table if not exists public.premium_content (
  content_id  text not null,
  kind        text not null check (kind in ('question','case','lesson')),
  body        jsonb not null,
  updated_at  timestamptz not null default now(),
  primary key (kind, content_id)
);

alter table public.premium_content enable row level security;

-- Deliberately no policy. Enabling RLS with none is a locked door, not an
-- oversight, and the verify script asserts it stays that way.
revoke all on table public.premium_content from anon, authenticated;

-- Table privileges. A policy decides WHICH ROWS a role may see; a grant
-- decides whether the role may touch the table at all, and both are needed.
-- Omitting these once left the pricing page empty with correct-looking
-- policies in place.
grant select on public.plans            to anon, authenticated;
grant select on public.plan_prices      to authenticated;
grant select on public.payments         to authenticated;
grant select on public.access_grants    to authenticated;
grant select on public.stripe_customers to authenticated;
grant select on public.stripe_events    to authenticated;
grant select on public.access_audit     to authenticated;
-- premium_content gets none, deliberately.

comment on table public.premium_content is
  'Premium items, unreachable from any browser. Read only by the premium-content function after an entitlement check.';
