-- Track credit purchases for history and idempotency
create table if not exists public.credit_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Stripe identifiers (for debugging and reconciliation)
  stripe_session_id text not null,
  stripe_event_id text not null unique,  -- For idempotency
  stripe_price_id text not null,

  -- Purchase details
  credits_purchased decimal(12, 4) not null,
  amount_paid_cents integer not null,

  -- Status tracking
  status text not null default 'completed',  -- completed, refunded

  -- Timestamps
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Indexes for common queries
create index if not exists credit_purchases_user_id_idx
  on public.credit_purchases(user_id, created_at desc);

-- Enable RLS
alter table public.credit_purchases enable row level security;

-- Users can only view their own purchases
create policy "Users can view their own purchases"
  on public.credit_purchases
  for select
  using (user_id = auth.uid());

-- Only service role can insert (webhook uses service client)
-- No insert policy for regular users

-- Updated_at trigger
create or replace function public.handle_credit_purchases_updated_at()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger credit_purchases_set_updated_at
before update on public.credit_purchases
for each row execute function public.handle_credit_purchases_updated_at();
