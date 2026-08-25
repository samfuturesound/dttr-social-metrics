-- Let the brand admin trigger the derived refresh by hand.
--
-- A brand added via mx_add_brand has no rows in post_detail_mv until the
-- 03:30 'mx-refresh-derived' cron runs, so a share link created the same day
-- renders empty. This grant puts that refresh behind a button.
--
-- mx_refresh_derived is SECURITY DEFINER and uses REFRESH MATERIALIZED VIEW
-- CONCURRENTLY, so it does not block readers of post_detail_mv.
--
-- authenticated only. anon must never reach it: the share pages run as anon,
-- and a refresh is far more expensive than the share reads it would sit
-- alongside. Stated explicitly rather than relying on inheritance, then
-- verified below.

revoke execute on function public.mx_refresh_derived() from public, anon;
grant execute on function public.mx_refresh_derived() to authenticated;

do $$
begin
  if not has_function_privilege('authenticated', 'public.mx_refresh_derived()', 'EXECUTE') then
    raise exception 'authenticated did not receive EXECUTE on mx_refresh_derived';
  end if;
  if has_function_privilege('anon', 'public.mx_refresh_derived()', 'EXECUTE') then
    raise exception 'anon can execute mx_refresh_derived - refusing to leave it exposed';
  end if;
  if not has_function_privilege('service_role', 'public.mx_refresh_derived()', 'EXECUTE') then
    raise exception 'service_role lost EXECUTE on mx_refresh_derived - the cron job would break';
  end if;
end $$;

notify pgrst, 'reload schema';
