grant usage on schema metrics to service_role;
grant select on all tables in schema metrics to service_role;
grant select, insert, update on metrics.raw_snapshots to service_role;
grant select, insert on metrics.debug_log to service_role;
grant select, insert on metrics.digest_sends to service_role;
grant usage, select on all sequences in schema metrics to service_role;

alter default privileges in schema metrics grant select on tables to service_role;

notify pgrst, 'reload schema';
