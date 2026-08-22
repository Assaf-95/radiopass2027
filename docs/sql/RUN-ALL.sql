-- =====================================================================
-- RadioPass — complete database setup, in one file.
--
-- Paste the WHOLE thing into the Supabase SQL Editor and press Run.
-- The scripts are concatenated in dependency order and every one is
-- idempotent, so running this twice changes nothing the second time.
--
--   1. schema.sql          accounts, progress, content
--   2. permissions.sql     the six staff seats
--   3. payments.sql        plans, the access ledger, Stripe
--   4. owner-dashboard.sql the numbers
--   5. fix-grants.sql      table privileges (a policy is not a grant)
--   6. verify-security.sql proves the refusals — prints PASS lines
--
-- The checks print NOTICEs, which Supabase shows under Logs rather than
-- in the results pane. "Success. No rows returned" IS the pass: every
-- check raises an exception on failure, so an error would have stopped
-- the run and shown you the reason.
-- =====================================================================


-- ###################################################################
-- ###  radiopass-website/supabase/schema.sql
-- ###################################################################

-- RadioPass — user progress schema.
--
-- Run this once in the Supabase dashboard: SQL Editor → New query → paste
-- this whole file → Run. Safe to re-run (every statement is idempotent).
--
-- One JSONB blob per user per data domain, mirroring the exact shape each
-- part of the app already used in localStorage — qbank_progress.data is a
-- QbProgress, qbank_marks.data is a QbMarks, us_progress.data is a
-- UsProgress (see src/qbank/Shell.tsx and src/us/components/progress.ts).
-- Keeping the shape identical means the app code changes, not the data.

create table if not exists public.qbank_progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.qbank_marks (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.us_progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{"visited":[],"answered":{}}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Anatomy. These four are newer than the three above: until now anatomy kept
-- everything in localStorage and nothing followed the account, so answering a
-- hundred questions on a laptop and signing in on another machine showed an
-- empty bank. The interface said progress followed the account, which the
-- storage did not do. Same one-blob-per-user shape as the physics tables, and
-- the same localStorage keys underneath, so nobody's existing work resets.

create table if not exists public.anatomy_progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{"questions":{}}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.anatomy_disputes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- Where the candidate had reached in each region, so Continue works on a
-- second device rather than starting them at question one.
create table if not exists public.anatomy_bookmarks (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- The shared learner timeline — mock attempts, module completions, activity
-- days — written by both branches. An append-only array, deduplicated and
-- re-capped on merge (see src/lib/learner.ts).
create table if not exists public.learner_events (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- WHAT AN ACCOUNT HAS PAID FOR.
--
-- Unlike every other table here, this one is NOT written by the browser. The
-- policies below give an authenticated user SELECT on their own row and
-- nothing else — no insert, no update — so a learner can read their
-- entitlement and cannot grant themselves one. Rows are written by the
-- service role: a payment webhook, or the owner in the dashboard.
--
-- grants is a set of the strings in src/lib/access.ts: 'account', 'trial',
-- 'anatomy', 'physics', 'full', 'admin'. expires_at null means it does not
-- lapse; a trial sets it.
--
-- HONEST LIMIT, stated here because this is where someone will come looking:
-- this makes entitlement ACCOUNT-authoritative rather than localStorage-
-- authoritative, which is a real difference — it can no longer be flipped in
-- devtools. It does NOT make the content unreachable. Every question and
-- every lab ships inside the JavaScript bundle, so anyone who opens the
-- network tab has all of it regardless of what this table says. Gating
-- content properly means serving it on demand behind this check instead of
-- bundling it, which is a product decision, not a schema one.
create table if not exists public.entitlements (
  user_id uuid primary key references auth.users (id) on delete cascade,
  grants text[] not null default '{}',
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.entitlements enable row level security;

drop policy if exists "read own entitlement" on public.entitlements;
create policy "read own entitlement" on public.entitlements
  for select using (auth.uid() = user_id);

-- Deliberately select only. Writing is the service role's job.
grant select on public.entitlements to authenticated;

alter table public.qbank_progress enable row level security;
alter table public.qbank_marks enable row level security;
alter table public.us_progress enable row level security;
alter table public.anatomy_progress enable row level security;
alter table public.anatomy_disputes enable row level security;
alter table public.anatomy_bookmarks enable row level security;
alter table public.learner_events enable row level security;

-- Each user may only ever see or touch their own row. This is the actual
-- security boundary — the anon key embedded in the frontend is public by
-- design, and these policies are what stop one user reading another's data.
-- drop-then-create (rather than a PL/pgSQL existence check) so the whole
-- file is a flat list of plain statements — nothing that depends on
-- dollar-quoting surviving a copy-paste intact.

drop policy if exists "own row only" on public.qbank_progress;
create policy "own row only" on public.qbank_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own row only" on public.qbank_marks;
create policy "own row only" on public.qbank_marks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own row only" on public.us_progress;
create policy "own row only" on public.us_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own row only" on public.anatomy_progress;
create policy "own row only" on public.anatomy_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own row only" on public.anatomy_disputes;
create policy "own row only" on public.anatomy_disputes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own row only" on public.anatomy_bookmarks;
create policy "own row only" on public.anatomy_bookmarks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own row only" on public.learner_events;
create policy "own row only" on public.learner_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- RLS policies decide WHICH rows a role can see; Postgres separately
-- requires the role to be allowed to touch the table AT ALL. Tables made
-- through the SQL Editor don't get this automatically the way tables made
-- through the dashboard's Table Editor do — without it every request comes
-- back "permission denied" before RLS is even consulted.
grant select, insert, update on public.qbank_progress to authenticated;
grant select, insert, update on public.qbank_marks to authenticated;
grant select, insert, update on public.us_progress to authenticated;
grant select, insert, update on public.anatomy_progress to authenticated;
grant select, insert, update on public.anatomy_disputes to authenticated;
grant select, insert, update on public.anatomy_bookmarks to authenticated;
grant select, insert, update on public.learner_events to authenticated;

-- ===========================================================================
-- Authoring — the editable copy of the content, and the images behind it.
--
-- The anatomy dataset (501 questions) and the physics bank (467) ship inside
-- the JavaScript bundle and are NEVER written to. Everything an author changes
-- is recorded here as an overlay on top of that base, and every surface reads
-- base-through-overlay. That is what makes an edit revertible and what stops a
-- bad edit destroying the source material.
--
-- This mirrors the document store the Node content API already speaks
-- (getJSON/setJSON over a handful of keys), so the same overlay shape works
-- whether it is served from a filesystem in development or from here in the
-- browser. Keys in use: 'anatomy-overlay', 'anatomy-audit', 'physics-overlay',
-- 'physics-audit', 'structure-folders'.
--
-- SECURITY. Reading is open to any signed-in candidate, because the overlay is
-- simply the current content and they are going to be shown it anyway. WRITING
-- requires the 'admin' grant in public.entitlements, which only the service
-- role can hand out — so an author cannot promote themselves from the browser,
-- and the localStorage passcode that gates the admin INTERFACE cannot grant
-- any actual write.
-- ===========================================================================

create table if not exists public.content_documents (
  key text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);

alter table public.content_documents enable row level security;

-- True when the caller holds the admin grant. Security definer so it can read
-- entitlements rows other than the caller's own row-level view.
create or replace function public.is_content_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.entitlements e
    where e.user_id = auth.uid()
      and 'admin' = any (e.grants)
      and (e.expires_at is null or e.expires_at > now())
  );
$$;

drop policy if exists "anyone signed in may read content" on public.content_documents;
create policy "anyone signed in may read content" on public.content_documents
  for select using (auth.uid() is not null);

drop policy if exists "only admins may write content" on public.content_documents;
create policy "only admins may write content" on public.content_documents
  for all using (public.is_content_admin()) with check (public.is_content_admin());

grant select on public.content_documents to authenticated;
grant insert, update on public.content_documents to authenticated;

-- Every write, kept separately from the document so a bad edit can be traced
-- to a person and a time even after the document has moved on.
create table if not exists public.content_audit (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor uuid references auth.users (id),
  key text not null,
  action text not null,
  detail jsonb
);

alter table public.content_audit enable row level security;

drop policy if exists "admins read the audit" on public.content_audit;
create policy "admins read the audit" on public.content_audit
  for select using (public.is_content_admin());

drop policy if exists "admins append to the audit" on public.content_audit;
create policy "admins append to the audit" on public.content_audit
  for insert with check (public.is_content_admin());

grant select, insert on public.content_audit to authenticated;
grant usage, select on sequence public.content_audit_id_seq to authenticated;


-- ###################################################################
-- ###  docs/sql/permissions.sql
-- ###################################################################

-- =====================================================================
-- RUN AFTER radiopass-website/supabase/schema.sql, which creates
-- entitlements, content_documents, content_audit and the progress
-- tables. Everything here builds on those.
--
-- A NOTE ON to_jsonb(grants). The base schema declares grants as
-- text[], but a live row exports as ["account","full","admin"], which is
-- jsonb — the two disagree, and `grants ? 'admin'` is a jsonb-only
-- operator that errors on an array. to_jsonb() is the identity on jsonb
-- and converts text[] to a JSON array, so wrapping the column makes the
-- membership test correct whichever the column actually is. Cheap
-- insurance against a file that runs on one deployment and fails on the
-- next.
--
-- RadioPass permissions.
--
-- Run this in the Supabase SQL Editor, on BOTH the production and the
-- staging project. It is idempotent: running it twice changes nothing
-- the second time, so it is safe to re-run after an edit.
--
-- WHY THIS FILE EXISTS AT ALL. src/lib/roles.ts decides what the
-- interface OFFERS. This decides what the database ALLOWS. They are
-- deliberately two different things: anybody can edit JavaScript in
-- their own browser, and doing so must win them nothing but buttons
-- that fail. Every rule that matters is repeated here, because here is
-- where it is true.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. The seat each person holds.
--
-- Separate from `grants`, which says what a person may READ. The two
-- axes are genuinely independent: a beta tester reads everything and
-- edits nothing; a contributor drafts on a branch he has not paid for.
-- ---------------------------------------------------------------------
alter table public.entitlements
  add column if not exists role text;

alter table public.entitlements
  drop constraint if exists entitlements_role_check;

alter table public.entitlements
  add constraint entitlements_role_check
  check (role is null or role in (
    'owner','administrator','senior-editor','reviewer','contributor','beta-tester'
  ));

comment on column public.entitlements.role is
  'Authoring seat. NULL means a candidate: reads according to grants, changes nothing.';

-- Exactly one owner. A second owner is not a stricter setup, it is an
-- ambiguous one — two people who can each remove the other.
create unique index if not exists entitlements_single_owner
  on public.entitlements ((role)) where role = 'owner';

-- ---------------------------------------------------------------------
-- 2. Who am I, and what may I do.
--
-- SECURITY DEFINER so the function can read entitlements while the
-- caller cannot read anyone's row but their own. STABLE so Postgres may
-- evaluate it once per statement rather than once per row — on a policy
-- that guards a large table the difference is not academic.
--
-- search_path is pinned. Without it a SECURITY DEFINER function can be
-- pointed at a different schema by whoever calls it, which is the
-- classic way one of these becomes a privilege escalation.
-- ---------------------------------------------------------------------
create or replace function public.user_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select e.role
  from public.entitlements e
  where e.user_id = auth.uid()
    and (e.expires_at is null or e.expires_at > now())
$$;

-- The matrix from src/lib/roles.ts, restated. If you change one, change
-- the other: src/lib/roles.test.ts pins the TypeScript side, and a
-- disagreement between them shows up as a button that does nothing.
create or replace function public.has_capability(cap text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case public.user_role()
    when 'owner'         then true
    -- Everything except handing ownership on. Without this exclusion
    -- 'administrator' IS 'owner', and the person who owns the product
    -- can be locked out of it by someone he invited.
    when 'administrator' then cap <> 'users:transferOwnership'
    when 'senior-editor' then cap in ('content:draft','content:publish','content:delete',
                                      'content:viewDrafts','content:comment','staging:access')
    -- Reads and comments. Cannot publish, cannot delete: the value of a
    -- reviewer is an opinion that costs nothing to ignore.
    when 'reviewer'      then cap in ('content:viewDrafts','content:comment','staging:access')
    when 'contributor'   then cap in ('content:draft','content:viewDrafts',
                                      'content:comment','staging:access')
    when 'beta-tester'   then cap = 'staging:access'
    else false
  end
$$;

-- ---------------------------------------------------------------------
-- 3. Keep the existing gate working.
--
-- is_content_admin() already guards content_documents and the anatomy
-- image bucket. Redefining it purely in terms of roles would lock out
-- every account that holds the old 'admin' grant the moment this file
-- runs. So it answers true for EITHER, and the old path can be retired
-- later once every account has a seat.
-- ---------------------------------------------------------------------
create or replace function public.is_content_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.has_capability('content:publish')
      or exists (
        select 1 from public.entitlements e
        where e.user_id = auth.uid()
          and to_jsonb(e.grants) ? 'admin'
          and (e.expires_at is null or e.expires_at > now())
      )
$$;

-- ---------------------------------------------------------------------
-- 4. Backfill, so nobody loses access the moment this runs.
-- ---------------------------------------------------------------------
update public.entitlements e
set role = 'administrator'
where e.role is null and to_jsonb(e.grants) ? 'admin';

-- The owner. Change the address if it is ever not this one.
update public.entitlements e
set role = 'owner'
from auth.users u
where u.id = e.user_id
  and u.email = 'dr.assafalassaf@gmail.com';

-- ---------------------------------------------------------------------
-- 5. Reading and changing seats.
--
-- A person may always see their own row — the app shows you what you
-- are. Only a seat holding users:manage may see everyone, and only such
-- a seat may write. The WITH CHECK on the update is what stops somebody
-- promoting himself: he can manage people, but the row he writes must
-- not be an owner unless he may transfer ownership.
-- ---------------------------------------------------------------------
alter table public.entitlements enable row level security;

drop policy if exists "read own entitlement" on public.entitlements;
create policy "read own entitlement"
  on public.entitlements for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "managers read all entitlements" on public.entitlements;
create policy "managers read all entitlements"
  on public.entitlements for select to authenticated
  using (public.has_capability('users:manage'));

drop policy if exists "managers write entitlements" on public.entitlements;
create policy "managers write entitlements"
  on public.entitlements for all to authenticated
  using (
    public.has_capability('users:manage')
    -- Nobody edits the owner's row but the owner.
    and (role is distinct from 'owner' or public.has_capability('users:transferOwnership'))
  )
  with check (
    public.has_capability('users:manage')
    and (role is distinct from 'owner' or public.has_capability('users:transferOwnership'))
  );

-- ---------------------------------------------------------------------
-- 6. Content, and the films.
--
-- Publishing is the boundary. A contributor's draft lives in Sanity,
-- not here, so what this table needs is simply: changing live content
-- requires content:publish.
-- ---------------------------------------------------------------------
alter table public.content_documents enable row level security;

drop policy if exists "publishers write content" on public.content_documents;
create policy "publishers write content"
  on public.content_documents for all to authenticated
  using (public.is_content_admin())
  with check (public.is_content_admin());

drop policy if exists "signed-in readers read content" on public.content_documents;
create policy "signed-in readers read content"
  on public.content_documents for select to authenticated
  using (true);

-- The anatomy film bucket. Uploading and replacing a film is publishing
-- a change to a live question, so it takes the same capability.
drop policy if exists "admins manage anatomy films" on storage.objects;
create policy "admins manage anatomy films"
  on storage.objects for all to authenticated
  using      (bucket_id = 'anatomy-images' and public.is_content_admin())
  with check (bucket_id = 'anatomy-images' and public.is_content_admin());

-- ---------------------------------------------------------------------
-- 7. Check it did what you think.
-- ---------------------------------------------------------------------
-- select u.email, e.role, e.grants
-- from public.entitlements e join auth.users u on u.id = e.user_id
-- order by e.role nulls last;


-- ###################################################################
-- ###  docs/sql/payments.sql
-- ###################################################################

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


-- ###################################################################
-- ###  docs/sql/owner-dashboard.sql
-- ###################################################################

-- =====================================================================
-- Numbers for the owner dashboard.
--
-- Run in the Supabase SQL Editor after docs/sql/permissions.sql, which
-- defines has_capability(). Idempotent — safe to re-run.
--
-- ONE function, returning ONE json object of AGGREGATES. Deliberately
-- not a set of views the client can query freely: a view over
-- auth.users is one careless policy away from leaking every candidate's
-- email address, and a dashboard needs counts, not people. Nothing here
-- can return a row about an individual.
-- =====================================================================

create or replace function public.owner_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
declare
  result jsonb;
begin
  -- The gate. SECURITY DEFINER means this function reads auth.users with
  -- the definer's rights, so without this check ANY signed-in candidate
  -- could call it and learn the business's numbers.
  if not public.has_capability('users:manage') then
    raise exception 'Not permitted' using errcode = '42501';
  end if;

  select jsonb_build_object(

    'accounts', (
      select jsonb_build_object(
        'total',    count(*),
        'last7',    count(*) filter (where created_at > now() - interval '7 days'),
        'last30',   count(*) filter (where created_at > now() - interval '30 days'),
        -- Someone who signed up and never came back is a different problem
        -- from someone who never signed up, so it is counted separately.
        'confirmed', count(*) filter (where email_confirmed_at is not null)
      ) from auth.users
    ),

    -- Plans, from the grants each account holds. 'full' and a branch grant
    -- are counted apart because they are different products, and a single
    -- "subscribers" number would hide anatomy-only selling better than
    -- physics or the reverse.
    'plans', (
      select jsonb_build_object(
        'full',        count(*) filter (where to_jsonb(grants) ? 'full'),
        'anatomy_only',count(*) filter (where to_jsonb(grants) ? 'anatomy' and not to_jsonb(grants) ? 'full'),
        'physics_only',count(*) filter (where to_jsonb(grants) ? 'physics' and not to_jsonb(grants) ? 'full'),
        'trial',       count(*) filter (where to_jsonb(grants) ? 'trial'),
        'free',        count(*) filter (where to_jsonb(grants) ? 'account'
                                        and not to_jsonb(grants) ? 'full'
                                        and not to_jsonb(grants) ? 'anatomy'
                                        and not to_jsonb(grants) ? 'physics'),
        'expiring_30', count(*) filter (where expires_at is not null
                                        and expires_at between now() and now() + interval '30 days')
      ) from public.entitlements
    ),

    'team', (
      select coalesce(jsonb_object_agg(role, n), '{}'::jsonb)
      from (select role, count(*) n from public.entitlements
            where role is not null group by role) t
    ),

    -- Active learners. updated_at is written every time progress syncs, so
    -- "touched in the last 7 days" is the closest thing to a weekly active
    -- count this schema can honestly give. Distinct across the three
    -- progress tables, so one person studying both halves counts once.
    'active', (
      select jsonb_build_object(
        'last7',  count(distinct user_id) filter (where updated_at > now() - interval '7 days'),
        'last30', count(distinct user_id) filter (where updated_at > now() - interval '30 days')
      )
      from (
        select user_id, updated_at from public.anatomy_progress
        union all
        select user_id, updated_at from public.qbank_progress
        union all
        select user_id, updated_at from public.us_progress
      ) p
    ),

    'study', (
      select jsonb_build_object(
        'anatomy_learners', (select count(*) from public.anatomy_progress),
        'physics_learners', (select count(*) from public.qbank_progress),
        'flagged',          (select count(*) from public.qbank_marks),
        'disputes',         (select count(*) from public.anatomy_disputes)
      )
    ),

    'authoring', (
      select jsonb_build_object(
        'edits_total',  (select count(*) from public.content_audit),
        'edits_last30', (select count(*) from public.content_audit
                          where created_at > now() - interval '30 days')
      )
    ),

    'generated_at', to_jsonb(now())
  ) into result;

  return result;
end;
$$;

revoke all on function public.owner_metrics() from public, anon;
grant execute on function public.owner_metrics() to authenticated;

-- Sign-ups per day for the last 90 days, for the chart. Same gate.
create or replace function public.owner_signup_series()
returns table (day date, signups bigint)
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
  -- generate_series, not group-by-alone: a day with no sign-ups must appear
  -- as a zero rather than vanish, or the chart silently compresses quiet
  -- weeks and every trend reads better than it was.
  select d::date, count(u.id)
  from generate_series(current_date - 89, current_date, interval '1 day') d
  left join auth.users u on u.created_at::date = d::date
  group by d
  order by d;
end;
$$;

revoke all on function public.owner_signup_series() from public, anon;
grant execute on function public.owner_signup_series() to authenticated;


-- ###################################################################
-- ###  docs/sql/fix-grants.sql
-- ###################################################################

-- =====================================================================
-- Table-level privileges for the payment tables.
--
-- WHY THIS WAS MISSING AND WHY IT MATTERS. In Postgres, a row-level
-- policy and a table GRANT are two different permissions and BOTH are
-- required. My files created the policies and not the grants, so the
-- policies were deciding which rows a role could see for a role that
-- could not read the table at all. The visible symptom is an empty
-- pricing page.
--
-- schema.sql already does this correctly for its own tables (see its
-- `grant select on public.entitlements to authenticated`), and these
-- follow the same pattern.
--
-- Safe to run more than once. Run it after RUN-ALL.sql.
-- =====================================================================

-- The pricing page is public, so anon needs to read it. The policy still
-- limits the rows to active plans; this only makes the table visible at all.
grant select on public.plans to anon, authenticated;

-- The rest are readable only by their owner or a manager, and that is
-- enforced by the policies. Without the grant the policies never run.
grant select on public.plan_prices     to authenticated;
grant select on public.payments        to authenticated;
grant select on public.access_grants   to authenticated;
grant select on public.stripe_customers to authenticated;
grant select on public.stripe_events   to authenticated;
grant select on public.access_audit    to authenticated;

-- premium_content gets NOTHING, deliberately. It has no policy and no
-- grant, so it is unreachable from any browser whatever it claims. The
-- premium-content Edge Function reads it with the service role, after
-- has_paid_access() has answered.

-- public_plans() becomes SECURITY DEFINER so the pricing page works even
-- if table privileges are ever tightened again. It returns only the
-- columns a price list needs and only active plans, so running it with
-- the definer's rights exposes nothing a visitor could not already see.
create or replace function public.public_plans()
returns table (id text, name text, months integer, amount_pence integer,
               currency text, purchasable boolean, sort_order integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select id, name, months, amount_pence, currency, purchasable, sort_order
  from public.plans where active order by sort_order
$$;

grant execute on function public.public_plans() to anon, authenticated;

-- Confirm. Both should return rows rather than a permission error.
select 'plans readable' as check, count(*) from public.plans;
select 'public_plans() works' as check, count(*) from public.public_plans();


-- ###################################################################
-- ###  docs/sql/verify-security.sql
-- ###################################################################

-- =====================================================================
-- Prove the refusals. Run in the Supabase SQL Editor after the other
-- three files. It changes nothing; it raises if a rule is missing.
--
-- These cases cannot be tested from the JavaScript suite: they are
-- about what the DATABASE refuses when a browser asks directly, which
-- is the only place the answer matters. A React app that hides a button
-- proves nothing about what the API accepts.
--
-- Every check asserts a REFUSAL. Passing means somebody could not do
-- something.
-- =====================================================================

do $$
declare
  n integer;
begin
  raise notice '--- RadioPass access security ---';

  -- 1. The access tables must have no write policy for ordinary users.
  --    Their only way in is the SECURITY DEFINER functions, which check
  --    capability and write an audit row.
  select count(*) into n
  from pg_policies
  where schemaname = 'public'
    and tablename in ('access_grants','payments','stripe_customers','stripe_events')
    and cmd in ('INSERT','UPDATE','DELETE','ALL')
    and 'authenticated' = any(roles);
  if n > 0 then
    raise exception 'FAIL: % write policies exist on the access tables. A user could edit their own expiry.', n;
  end if;
  raise notice 'PASS  no user-writable policy on access_grants / payments / stripe_customers / stripe_events';

  -- 2. Every table that holds access or money must have RLS ON at all.
  --    A table with policies but RLS disabled is wide open and looks safe.
  select count(*) into n
  from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
  where ns.nspname = 'public'
    and c.relname in ('access_grants','payments','stripe_customers','stripe_events',
                      'entitlements','plans','plan_prices','access_audit')
    and c.relrowsecurity = false;
  if n > 0 then
    raise exception 'FAIL: % access/money tables have RLS disabled.', n;
  end if;
  raise notice 'PASS  row level security enabled on every access and money table';

  -- 3. The functions that grant access must not be callable by ordinary
  --    users. apply_stripe_purchase is the webhook's; a user who could
  --    call it could award themselves twelve months.
  select count(*) into n
  from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public'
    and p.proname in ('apply_stripe_purchase','record_stripe_refund','record_plan_price')
    and has_function_privilege('authenticated', p.oid, 'EXECUTE');
  if n > 0 then
    raise exception 'FAIL: % granting functions are executable by authenticated users.', n;
  end if;
  raise notice 'PASS  apply_stripe_purchase / record_stripe_refund / record_plan_price are service-role only';

  -- 4. Every SECURITY DEFINER function must pin search_path. Without it
  --    the caller can point the function at their own schema, which is
  --    the classic route from "definer" to "superuser".
  select count(*) into n
  from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public' and p.prosecdef
    and not exists (select 1 from unnest(coalesce(p.proconfig,'{}')) cfg
                    where cfg like 'search_path=%');
  if n > 0 then
    raise exception 'FAIL: % SECURITY DEFINER functions do not pin search_path.', n;
  end if;
  raise notice 'PASS  every SECURITY DEFINER function pins search_path';

  -- 5. One owner, enforced by an index rather than by convention.
  if not exists (select 1 from pg_indexes
                 where schemaname='public' and indexname='entitlements_single_owner') then
    raise exception 'FAIL: nothing prevents a second owner.';
  end if;
  raise notice 'PASS  a second owner is impossible';

  -- 6. Stripe event ids are a primary key, which is what makes a replay
  --    impossible rather than merely unlikely.
  if not exists (
    select 1 from pg_constraint c join pg_class t on t.oid = c.conrelid
    where t.relname = 'stripe_events' and c.contype = 'p') then
    raise exception 'FAIL: stripe_events has no primary key — a replayed webhook could grant twice.';
  end if;
  raise notice 'PASS  a replayed Stripe webhook cannot grant access twice';

  -- 7. The free plan cannot be purchased.
  if (select purchasable from public.plans where id = 'free') then
    raise exception 'FAIL: the free plan is marked purchasable.';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'access_grants_purchasable') then
    raise exception 'FAIL: nothing stops a stripe grant for a non-purchasable plan.';
  end if;
  raise notice 'PASS  free cannot be bought, and a stripe grant for it is refused';

  -- 8. Premium content must be unreachable from a browser entirely.
  --    Not "hidden by a policy" — no policy at all, so there is nothing to
  --    get wrong. If anybody ever adds one, this fails.
  select count(*) into n from pg_policies
  where schemaname='public' and tablename='premium_content';
  if n > 0 then
    raise exception 'FAIL: premium_content has % policies. It must have NONE — the Edge Function is the only reader.', n;
  end if;
  if not exists (select 1 from pg_class c join pg_namespace ns on ns.oid=c.relnamespace
                 where ns.nspname='public' and c.relname='premium_content' and c.relrowsecurity) then
    raise exception 'FAIL: premium_content does not have RLS enabled.';
  end if;
  raise notice 'PASS  premium content is unreachable from any browser';

  raise notice '--- all checks passed ---';
end $$;

-- A user cannot see anybody else's access. Run this signed in as a
-- normal account: it must return only that account's own rows.
--   select * from public.access_grants;
--   select * from public.payments;
