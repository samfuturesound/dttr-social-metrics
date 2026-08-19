revoke execute on function public.mx_digest_claim() from anon, authenticated, public;
grant execute on function public.mx_digest_claim() to service_role;
notify pgrst, 'reload schema';
