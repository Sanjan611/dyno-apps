-- Waitlist table for beta access requests
create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  company text,
  use_case text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  invited_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Auto-update timestamp trigger (reuse if already exists from other migrations)
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

create trigger update_waitlist_updated_at
  before update on public.waitlist
  for each row execute function public.update_updated_at_column();

-- RLS: Admin only (via service role key)
alter table public.waitlist enable row level security;

-- No public policies - all access via service role key

-- Indexes for status and email queries
create index waitlist_status_idx on public.waitlist(status);
create index waitlist_email_idx on public.waitlist(email);
