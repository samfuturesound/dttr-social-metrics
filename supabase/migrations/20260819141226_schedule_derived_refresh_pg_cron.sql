create extension if not exists pg_cron;

select cron.schedule(
  'mx-refresh-derived',
  '30 3 * * *',
  $$select public.mx_refresh_derived();$$
);
