alter table public.applications
  add column if not exists status_history jsonb not null default '[]'::jsonb;
