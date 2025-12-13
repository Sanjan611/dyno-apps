-- Add user_limits table to track project limits per user
-- Default limit is 3 projects per user

create table if not exists public.user_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  max_projects integer not null default 3,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Create index for faster lookups
create index if not exists user_limits_user_id_idx on public.user_limits(user_id);

-- Create function to handle updated_at timestamp
create function public.handle_user_limits_updated_at()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- Create trigger for updated_at
drop trigger if exists user_limits_set_updated_at on public.user_limits;
create trigger user_limits_set_updated_at
before update on public.user_limits
for each row execute function public.handle_user_limits_updated_at();

-- Enable Row Level Security
alter table public.user_limits enable row level security;

-- Policy: Users can only read their own limits
drop policy if exists "User limits are selectable by owners" on public.user_limits;
create policy "User limits are selectable by owners"
  on public.user_limits
  for select
  using (user_id = auth.uid());

-- Note: Insert/update/delete operations are admin-only via Supabase dashboard
-- No RLS policies for insert/update/delete to prevent users from modifying their own limits

