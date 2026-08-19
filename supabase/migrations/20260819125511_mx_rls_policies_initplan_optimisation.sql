do $$
declare r record;
begin
  for r in
    select tablename from pg_policies
    where schemaname='metrics' and policyname='mx_internal_read'
  loop
    execute format('drop policy mx_internal_read on metrics.%I', r.tablename);
    execute format(
      'create policy mx_internal_read on metrics.%I for select to authenticated using ((select public.mx_is_internal()))',
      r.tablename);
  end loop;
end $$;
