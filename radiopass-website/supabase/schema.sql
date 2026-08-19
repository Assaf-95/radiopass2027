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
