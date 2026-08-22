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
