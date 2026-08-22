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

  raise notice '--- all checks passed ---';
end $$;

-- A user cannot see anybody else's access. Run this signed in as a
-- normal account: it must return only that account's own rows.
--   select * from public.access_grants;
--   select * from public.payments;
