-- Correction to revoke_anon_from_write_functions, which had no effect.
--
-- mx_alert_claim's ACL was "=X/postgres" -- a grant to PUBLIC, which anon
-- inherits. Revoking anon by name doesn't touch it. mx_set_paid had the
-- opposite shape: a named anon grant that `revoke from public` didn't touch.
--
-- Both forms occur in this database, so locking a write function down means
-- revoking BOTH, then granting back explicitly. Neither revoke alone is
-- sufficient, and which one you need isn't visible without reading proacl.

revoke execute on function public.mx_alert_claim() from public;
revoke execute on function public.mx_alert_claim() from anon;
grant execute on function public.mx_alert_claim() to authenticated, service_role;