create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now()
);
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_id text not null,
  job jsonb not null,
  score integer not null check (score between 0 and 100),
  reasons text[] not null default '{}',
  dismissed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, source_id)
);
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_id text not null,
  job jsonb not null,
  status text not null default 'saved' check (status in ('saved', 'applied', 'interview', 'offer', 'rejected', 'withdrawn')),
  notes text not null default '',
  letter text not null default '',
  follow_up date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source_id)
);
create table public.check_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_key text not null,
  state text not null default 'running' check (state in ('running', 'completed', 'failed')),
  matches_found integer not null default 0,
  message text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, run_key)
);
alter table public.profiles enable row level security;
alter table public.matches enable row level security;
alter table public.applications enable row level security;
alter table public.check_runs enable row level security;
create policy "Own profile" on public.profiles for all to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "Own matches" on public.matches for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Own applications" on public.applications for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Own check runs" on public.check_runs for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.profiles, public.matches, public.applications, public.check_runs to authenticated;
grant all on public.profiles, public.matches, public.applications, public.check_runs to service_role;
revoke all on public.profiles, public.matches, public.applications, public.check_runs from anon;
create index matches_user_score on public.matches(user_id, score desc);
create index applications_user_updated on public.applications(user_id, updated_at desc);
create index check_runs_user_created on public.check_runs(user_id, created_at desc);