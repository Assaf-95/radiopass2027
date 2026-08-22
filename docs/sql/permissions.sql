-- =====================================================================
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
          and e.grants ? 'admin'
          and (e.expires_at is null or e.expires_at > now())
      )
$$;

-- ---------------------------------------------------------------------
-- 4. Backfill, so nobody loses access the moment this runs.
-- ---------------------------------------------------------------------
update public.entitlements e
set role = 'administrator'
where e.role is null and e.grants ? 'admin';

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
