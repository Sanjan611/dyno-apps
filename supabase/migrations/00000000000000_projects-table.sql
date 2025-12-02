-- Supabase schema for Dyno Apps projects
-- Generated migration for projects table, RLS policies, and triggers

create extension if not exists "pgcrypto";

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  repository_url text,
  current_sandbox_id text,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists projects_user_id_idx on public.projects(user_id, updated_at desc);

create function public.handle_project_updated_at()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
before update on public.projects
for each row execute function public.handle_project_updated_at();

alter table public.projects enable row level security;

drop policy if exists "Projects are selectable by owners" on public.projects;
create policy "Projects are selectable by owners"
  on public.projects
  for select
  using (user_id = auth.uid());

drop policy if exists "Projects are insertable by owners" on public.projects;
create policy "Projects are insertable by owners"
  on public.projects
  for insert
  with check (user_id = auth.uid());

drop policy if exists "Projects are updatable by owners" on public.projects;
create policy "Projects are updatable by owners"
  on public.projects
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Projects are deletable by owners" on public.projects;
create policy "Projects are deletable by owners"
  on public.projects
  for delete
  using (user_id = auth.uid());


