-- Add user_credits table to track credit balance per user
-- Credits formula: credits = rawCost × (1 + margin%) × 10
-- Default: 10 initial credits for new users

create table if not exists public.user_credits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance decimal(12, 4) not null default 0,
  total_credits_added decimal(12, 4) not null default 0,
  total_credits_used decimal(12, 4) not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Create index for faster lookups
create index if not exists user_credits_user_id_idx on public.user_credits(user_id);

-- Create function to handle updated_at timestamp
create function public.handle_user_credits_updated_at()
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
drop trigger if exists user_credits_set_updated_at on public.user_credits;
create trigger user_credits_set_updated_at
before update on public.user_credits
for each row execute function public.handle_user_credits_updated_at();

-- Enable Row Level Security
alter table public.user_credits enable row level security;

-- Policy: Users can only read their own credits
drop policy if exists "User credits are selectable by owners" on public.user_credits;
create policy "User credits are selectable by owners"
  on public.user_credits
  for select
  using (user_id = auth.uid());

-- Policy: Users can insert their own credit record (for auto-creation of default credits)
drop policy if exists "User credits are insertable by owners" on public.user_credits;
create policy "User credits are insertable by owners"
  on public.user_credits
  for insert
  with check (user_id = auth.uid());

-- Note: UPDATE and DELETE are admin-only via service role key
-- No RLS policies for update/delete to prevent users from modifying their own credits
