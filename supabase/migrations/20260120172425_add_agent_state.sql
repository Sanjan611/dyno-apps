-- Migration: Add agent_state table for persistent conversation state
-- This replaces the in-memory Map storage with database persistence
-- Required for Trigger.dev tasks running in separate processes

create table if not exists public.agent_state (
  project_id uuid primary key references public.projects(id) on delete cascade,
  state jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

-- Index for fast lookups by updated_at (useful for cleanup queries)
create index if not exists agent_state_updated_at_idx on public.agent_state(updated_at);

-- Auto-update updated_at timestamp
create function public.handle_agent_state_updated_at()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists agent_state_set_updated_at on public.agent_state;
create trigger agent_state_set_updated_at
before update on public.agent_state
for each row execute function public.handle_agent_state_updated_at();

-- Enable Row Level Security
alter table public.agent_state enable row level security;

-- RLS policy: Users can only access state for their own projects
drop policy if exists "Agent state is accessible by project owners" on public.agent_state;
create policy "Agent state is accessible by project owners"
  on public.agent_state
  for all
  using (
    project_id in (
      select id from public.projects where user_id = auth.uid()
    )
  );
