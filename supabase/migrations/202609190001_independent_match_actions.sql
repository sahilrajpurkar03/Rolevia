alter table public.applications
  add column if not exists saved boolean not null default true;
