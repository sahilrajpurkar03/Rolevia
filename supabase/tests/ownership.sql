begin;

insert into auth.users (id, aud, role, email) values
  ('11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'rls-a@example.invalid'),
  ('22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'rls-b@example.invalid');
insert into public.profiles (id, data) values
  ('11111111-1111-4111-8111-111111111111', '{"fullName":"Test A"}'),
  ('22222222-2222-4222-8222-222222222222', '{"fullName":"Test B"}');
insert into public.applications (user_id, source_id, job) values
  ('11111111-1111-4111-8111-111111111111', 'test-a', '{}'),
  ('22222222-2222-4222-8222-222222222222', 'test-b', '{}');
insert into public.matches (user_id, source_id, job, score) values
  ('11111111-1111-4111-8111-111111111111', 'test-a', '{}', 50),
  ('22222222-2222-4222-8222-222222222222', 'test-b', '{}', 50);
insert into public.check_runs (user_id, run_key) values
  ('11111111-1111-4111-8111-111111111111', 'test-a'),
  ('22222222-2222-4222-8222-222222222222', 'test-b');

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);

do $$
declare affected integer;
begin
  if (select count(*) from public.profiles) <> 1 then raise exception 'Profile isolation failed'; end if;
  if (select count(*) from public.applications) <> 1 then raise exception 'Application isolation failed'; end if;
  if (select count(*) from public.matches) <> 1 then raise exception 'Match isolation failed'; end if;
  if (select count(*) from public.check_runs) <> 1 then raise exception 'Check isolation failed'; end if;
  update public.applications set notes = 'not allowed' where user_id = '22222222-2222-4222-8222-222222222222';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Cross-account update was allowed'; end if;
  begin
    insert into public.applications (user_id, source_id, job) values ('22222222-2222-4222-8222-222222222222', 'attack', '{}');
    raise exception 'Cross-account insert was allowed';
  exception when insufficient_privilege then null;
  end;
  update public.applications set notes = 'own update' where user_id = '11111111-1111-4111-8111-111111111111';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Own update failed'; end if;
end $$;

reset role;
rollback;