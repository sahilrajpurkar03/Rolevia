alter table public.applications
  add column if not exists interview_date date,
  add column if not exists interview_round text not null default '',
  add column if not exists interview_notes text not null default '';
