-- Migration: Add conversation_history table for persistent chat messages
-- Stores user-visible messages (user, assistant) up to last save point
-- Separate from agent_state which stores BAML Message[] for LLM context

create table if not exists public.conversation_history (
  project_id uuid primary key references public.projects(id) on delete cascade,
  messages jsonb not null default '[]'::jsonb,
  saved_at timestamptz not null default timezone('utc', now())
);

-- Index for fast lookups by saved_at (useful for cleanup queries)
create index if not exists conversation_history_saved_at_idx on public.conversation_history(saved_at);

-- Auto-update saved_at timestamp on upsert
create function public.handle_conversation_history_saved_at()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  new.saved_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists conversation_history_set_saved_at on public.conversation_history;
create trigger conversation_history_set_saved_at
before update on public.conversation_history
for each row execute function public.handle_conversation_history_saved_at();

-- Enable Row Level Security
alter table public.conversation_history enable row level security;

-- RLS policy: Users can only access history for their own projects
drop policy if exists "Conversation history is accessible by project owners" on public.conversation_history;
create policy "Conversation history is accessible by project owners"
  on public.conversation_history
  for all
  using (
    project_id in (
      select id from public.projects where user_id = auth.uid()
    )
  );
