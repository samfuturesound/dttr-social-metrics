revoke all on function public.mx_digest_claim() from public;
grant execute on function public.mx_digest_claim() to service_role;

revoke all on function public.mx_is_digest_week() from public;
grant execute on function public.mx_is_digest_week() to authenticated, service_role, anon;

notify pgrst, 'reload schema';
