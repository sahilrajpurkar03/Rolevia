alter table public.applications
  add column if not exists interview_completed boolean not null default false;
