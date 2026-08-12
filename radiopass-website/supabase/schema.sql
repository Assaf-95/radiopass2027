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

alter table public.qbank_progress enable row level security;
alter table public.qbank_marks enable row level security;
alter table public.us_progress enable row level security;

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

-- RLS policies decide WHICH rows a role can see; Postgres separately
-- requires the role to be allowed to touch the table AT ALL. Tables made
-- through the SQL Editor don't get this automatically the way tables made
-- through the dashboard's Table Editor do — without it every request comes
-- back "permission denied" before RLS is even consulted.
grant select, insert, update on public.qbank_progress to authenticated;
grant select, insert, update on public.qbank_marks to authenticated;
grant select, insert, update on public.us_progress to authenticated;
