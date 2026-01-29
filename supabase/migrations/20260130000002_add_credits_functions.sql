-- RPC function for atomic credit deduction
-- Uses SELECT ... FOR UPDATE to prevent race conditions

create or replace function public.deduct_user_credits(
  p_user_id uuid,
  p_credits_to_deduct decimal(12, 4)
)
returns table(success boolean, new_balance decimal(12, 4), error_message text)
language plpgsql
security definer set search_path = public
as $$
declare
  v_current_balance decimal(12, 4);
  v_new_balance decimal(12, 4);
begin
  -- Lock the row and get current balance
  select balance into v_current_balance
  from public.user_credits
  where user_id = p_user_id
  for update;

  -- If no record found, return error
  if not found then
    return query select false, 0::decimal(12,4), 'User credits record not found'::text;
    return;
  end if;

  -- Calculate new balance (allow going negative per plan)
  v_new_balance := v_current_balance - p_credits_to_deduct;

  -- Update the balance and total_credits_used
  update public.user_credits
  set
    balance = v_new_balance,
    total_credits_used = total_credits_used + p_credits_to_deduct,
    updated_at = timezone('utc', now())
  where user_id = p_user_id;

  return query select true, v_new_balance, null::text;
end;
$$;

-- RPC function to add credits (for admin topup)
create or replace function public.add_user_credits(
  p_user_id uuid,
  p_credits_to_add decimal(12, 4)
)
returns table(success boolean, new_balance decimal(12, 4), error_message text)
language plpgsql
security definer set search_path = public
as $$
declare
  v_new_balance decimal(12, 4);
begin
  -- Update balance and total_credits_added
  update public.user_credits
  set
    balance = balance + p_credits_to_add,
    total_credits_added = total_credits_added + p_credits_to_add,
    updated_at = timezone('utc', now())
  where user_id = p_user_id
  returning balance into v_new_balance;

  -- If no record found, return error
  if not found then
    return query select false, 0::decimal(12,4), 'User credits record not found'::text;
    return;
  end if;

  return query select true, v_new_balance, null::text;
end;
$$;

-- Grant execute permissions to authenticated users (will be called via service client)
grant execute on function public.deduct_user_credits(uuid, decimal(12, 4)) to authenticated;
grant execute on function public.add_user_credits(uuid, decimal(12, 4)) to authenticated;
