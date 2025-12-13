-- Add title_manually_updated field to track whether user manually set the title
-- This enables automatic title generation after first message

alter table public.projects
  add column if not exists title_manually_updated boolean not null default false;

-- Add a comment for documentation
comment on column public.projects.title_manually_updated is
  'Tracks whether the user has manually updated the project title. When false, the system can auto-generate titles based on user prompts.';
