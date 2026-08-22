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
        'full',        count(*) filter (where grants ? 'full'),
        'anatomy_only',count(*) filter (where grants ? 'anatomy' and not grants ? 'full'),
        'physics_only',count(*) filter (where grants ? 'physics' and not grants ? 'full'),
        'trial',       count(*) filter (where grants ? 'trial'),
        'free',        count(*) filter (where grants ? 'account'
                                        and not grants ? 'full'
                                        and not grants ? 'anatomy'
                                        and not grants ? 'physics'),
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
