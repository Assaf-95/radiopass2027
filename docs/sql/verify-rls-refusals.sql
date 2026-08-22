-- Real RLS, honestly measured.
--
-- The first version of this recorded results INSIDE the authenticated role,
-- so `insert into _r` was itself refused and the exception handler logged
-- "refused" whether or not the attack had been blocked. Every check was a
-- possible false pass. Here the role is reset before anything is written, and
-- SQLERRM is captured so a genuine policy refusal can be told apart from a
-- harness problem.
do $$
declare
  victim uuid := gen_random_uuid();
  attacker uuid := gen_random_uuid();
  n int; err text; sanity text;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at)
  select x,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
         'rls-'||x||'@radiopass.test','',now(),now(),now()
  from unnest(array[victim,attacker]) x;
  insert into public.entitlements (user_id, grants) values (attacker,'{account}'::text[])
    on conflict (user_id) do nothing;
  insert into public.access_grants (user_id,source,branch,starts_at,expires_at,status)
    values (victim,'stripe','full',now(),now()+interval '3 months','active');

  create temporary table _r (label text, outcome text, detail text);

  -- Prove the harness itself works before trusting any refusal: auth.uid()
  -- must resolve, or everything is refused for the wrong reason.
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', json_build_object('sub',attacker,'role','authenticated')::text, true);
    sanity := coalesce(auth.uid()::text,'NULL');
    reset role;
  exception when others then reset role; sanity := 'ERROR'; end;
  insert into _r values ('HARNESS: auth.uid() resolves',
    case when sanity = attacker::text then 'yes' else 'NO — results meaningless' end, sanity);

  -- 1
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', json_build_object('sub',attacker,'role','authenticated')::text, true);
    insert into public.access_grants (user_id,source,branch,starts_at,expires_at,status)
      values (attacker,'stripe','full',now(),now()+interval '99 years','active');
    get diagnostics n = row_count; reset role; err := null;
  exception when others then reset role; n := -1; err := SQLERRM; end;
  insert into _r values ('grant myself premium', case when n>0 then 'ALLOWED — BAD' else 'refused' end, err);

  -- 2
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', json_build_object('sub',attacker,'role','authenticated')::text, true);
    update public.access_grants set expires_at = now()+interval '99 years' where user_id = victim;
    get diagnostics n = row_count; reset role; err := null;
  exception when others then reset role; n := -1; err := SQLERRM; end;
  insert into _r values ('edit another user''s expiry', case when n>0 then 'ALLOWED — BAD' else 'refused' end, err);

  -- 3
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', json_build_object('sub',attacker,'role','authenticated')::text, true);
    insert into public.payments (user_id,plan_id,amount_pence,status) values (attacker,'premium_12m',0,'paid');
    get diagnostics n = row_count; reset role; err := null;
  exception when others then reset role; n := -1; err := SQLERRM; end;
  insert into _r values ('create a fake payment', case when n>0 then 'ALLOWED — BAD' else 'refused' end, err);

  -- 4
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', json_build_object('sub',attacker,'role','authenticated')::text, true);
    update public.plans set amount_pence = 1 where id='premium_12m';
    get diagnostics n = row_count; reset role; err := null;
  exception when others then reset role; n := -1; err := SQLERRM; end;
  insert into _r values ('change a plan price', case when n>0 then 'ALLOWED — BAD' else 'refused' end, err);

  -- 5
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', json_build_object('sub',attacker,'role','authenticated')::text, true);
    update public.entitlements set role='owner' where user_id=attacker;
    get diagnostics n = row_count; reset role; err := null;
  exception when others then reset role; n := -1; err := SQLERRM; end;
  insert into _r values ('make myself owner', case when n>0 then 'ALLOWED — BAD' else 'refused' end, err);

  -- 6
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', json_build_object('sub',attacker,'role','authenticated')::text, true);
    select count(*) into n from public.premium_content; reset role; err := null;
  exception when others then reset role; n := -1; err := SQLERRM; end;
  insert into _r values ('read premium_content', case when n>0 then 'ALLOWED — BAD' else 'refused / empty' end, err);

  -- 7
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', json_build_object('sub',attacker,'role','authenticated')::text, true);
    select count(*) into n from public.access_grants where user_id=victim; reset role; err := null;
  exception when others then reset role; n := -1; err := SQLERRM; end;
  insert into _r values ('read another user''s grants', case when n>0 then 'ALLOWED — BAD' else 'refused / empty' end, err);

  -- 8
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', json_build_object('sub',attacker,'role','authenticated')::text, true);
    perform public.apply_stripe_purchase('rls_evt2', attacker, 'premium_12m','s','p','c',0);
    reset role; n := 1; err := null;
  exception when others then reset role; n := -1; err := SQLERRM; end;
  insert into _r values ('call apply_stripe_purchase', case when n>0 then 'ALLOWED — BAD' else 'refused' end, err);

  -- 9
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', json_build_object('sub',attacker,'role','authenticated')::text, true);
    perform public.grant_complimentary_access(attacker, 12, 'mine now');
    reset role; n := 1; err := null;
  exception when others then reset role; n := -1; err := SQLERRM; end;
  insert into _r values ('grant myself complimentary', case when n>0 then 'ALLOWED — BAD' else 'refused' end, err);

  -- 10 — must be ALLOWED
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', json_build_object('sub',victim,'role','authenticated')::text, true);
    select count(*) into n from public.access_grants where user_id=victim; reset role; err := null;
  exception when others then reset role; n := -1; err := SQLERRM; end;
  insert into _r values ('read MY OWN access (must work)', case when n>0 then 'allowed — correct' else 'REFUSED — BAD' end, err);
end $$;

select label, outcome, coalesce(left(detail,58),'') as detail,
       case when outcome like '%BAD%' or outcome like 'NO %' then 'FAIL' else 'PASS' end as result
from _r order by label;

delete from auth.users where email like 'rls-%@radiopass.test';
delete from public.stripe_events where id='rls_evt2';
