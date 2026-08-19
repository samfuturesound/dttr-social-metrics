-- Raise the per-statement timeout for the authenticated role from Supabase's
-- 8s default. This project runs on Micro compute and the heavier views need
-- the headroom; mx_post_detail and the ranks chain sit close enough to 8s that
-- the default trips them under load.
--
-- Applied originally as a direct statement, so it had no migration history
-- row. Recorded here so a rebuild from empty reproduces it.
alter role authenticated set statement_timeout = '20s';
