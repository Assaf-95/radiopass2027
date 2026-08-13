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
