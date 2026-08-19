-- Every public.mx_* view must be security_invoker so that the RLS on the
-- metrics base tables actually applies to the caller. On the old project all
-- but two already carried this; here they were all created fresh, so set it
-- across the board rather than only on the two that were wrong before.
do $$
declare v record;
begin
  for v in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'v' and c.relname like 'mx\_%'
  loop
    execute format('alter view public.%I set (security_invoker = true)', v.relname);
  end loop;
end $$;

-- Match the old project: share tables carry RLS with no policy, so they are
-- reachable only through the SECURITY DEFINER share functions.
alter table metrics.brand_shares enable row level security;
alter table metrics.label_shares enable row level security;

-- debug_log is excluded from mx_secure_metrics_views(), so gate it explicitly.
alter table metrics.debug_log enable row level security;
drop policy if exists mx_internal_read on metrics.debug_log;
create policy mx_internal_read on metrics.debug_log
  for select to authenticated using (public.mx_is_internal());
grant select on metrics.debug_log to authenticated;

notify pgrst, 'reload schema';
