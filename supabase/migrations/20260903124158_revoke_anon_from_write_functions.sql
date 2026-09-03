-- Same fault as mx_set_paid: Supabase's default privileges grant EXECUTE to
-- anon BY NAME at creation time, so `revoke execute ... from public` leaves
-- it in place. Every SECURITY DEFINER function that writes must revoke anon
-- explicitly.
--
-- mx_alert_claim writes metrics.alert_sends, which is what stops a breakout
-- post being emailed twice. Executable by anon, anyone holding the anon key
-- -- which ships in the share-page bundle -- could mark every pending
-- breakout as already sent and silently suppress the alert email.
--
-- FS-8 does not call this yet. When the third module is added in Make it
-- must use the service_role connection, not the anon key.

revoke execute on function public.mx_alert_claim() from anon;

-- The remaining anon-executable mx_* functions are read-only by design:
-- the mx_share_* / mx_label_share_* family (share links run as anon), and
-- the mx_is_internal / mx_assert_internal / mx_is_digest_week /
-- mx_network_label helpers, which anon must be able to evaluate inside RLS
-- policies. Those grants are correct and should stay.