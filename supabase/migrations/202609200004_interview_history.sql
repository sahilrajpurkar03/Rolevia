alter table public.applications
  add column if not exists interview_history jsonb not null default '[]'::jsonb;
