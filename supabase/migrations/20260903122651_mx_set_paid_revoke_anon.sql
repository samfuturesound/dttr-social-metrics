-- mx_set_paid is SECURITY DEFINER: it writes metrics.post_interventions with the
-- definer's rights, bypassing RLS. It was created with EXECUTE granted to anon.
--
-- The share routes run as anon, and the anon key is public - it ships inside the
-- built JS bundle. Left as granted, anyone holding that key could mark or unmark
-- any post by external_id and move every other post's median on that account.
--
-- Same rule as mx_refresh_derived: writes are for signed-in staff only. Stated
-- explicitly rather than assumed to be inherited from a default.

revoke execute on function public.mx_set_paid(text, boolean) from anon;
revoke execute on function public.mx_set_paid(text, boolean) from public;

grant execute on function public.mx_set_paid(text, boolean) to authenticated;

comment on function public.mx_set_paid(text, boolean) is
  'Marks a post paid (true) or clears it (false); returns the resulting state. Idempotent. authenticated only - never anon: it is SECURITY DEFINER and the anon key is public.';

notify pgrst, 'reload schema';
