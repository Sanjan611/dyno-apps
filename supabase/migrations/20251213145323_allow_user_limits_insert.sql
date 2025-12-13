-- Allow users to insert their own limit record (for auto-creation of default limits)
-- Users can only insert a record for themselves (user_id = auth.uid())
-- This allows the system to automatically create default limit records for existing users

drop policy if exists "User limits are insertable by owners" on public.user_limits;
create policy "User limits are insertable by owners"
  on public.user_limits
  for insert
  with check (user_id = auth.uid());

-- Note: UPDATE and DELETE are still admin-only to prevent users from modifying their limits

