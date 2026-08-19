-- Remove the `extras` CTE from metrics.post_engagement.
--
-- extras re-computed the identical DISTINCT ON that scored_posts' `latest` CTE
-- already performs, and the planner re-executed it once per scored_posts row:
-- 596 loops over all of raw_snapshots, 2,897,752 of 2,903,711 buffers, 99.8% of
-- the query's total cost. It also emitted 616 stories rows that could never
-- match, since scored_posts excludes stories.
--
-- `latest` already selects follows, reach and duration_seconds; it simply did
-- not project them. Projecting them from scored_posts and deleting the join
-- makes this a single pass. Verified equivalent: same 596 rows, identical
-- values, no duplicate join keys.

create or replace view metrics.scored_posts as
 WITH latest AS (
         SELECT DISTINCT ON (snapshots_aged.brand_id, snapshots_aged.network, snapshots_aged.content_type, snapshots_aged.external_id) snapshots_aged.id,
            snapshots_aged.brand_id,
            snapshots_aged.network,
            snapshots_aged.content_type,
            snapshots_aged.external_id,
            snapshots_aged.captured_on,
            snapshots_aged.published_at,
            snapshots_aged.permalink,
            snapshots_aged.caption,
            snapshots_aged.thumbnail_url,
            snapshots_aged.views,
            snapshots_aged.reach,
            snapshots_aged.likes,
            snapshots_aged.comments,
            snapshots_aged.shares,
            snapshots_aged.saves,
            snapshots_aged.follows,
            snapshots_aged.engagement_pct,
            snapshots_aged.avg_watch_seconds,
            snapshots_aged.duration_seconds,
            snapshots_aged.skip_rate,
            snapshots_aged.reposts,
            snapshots_aged.payload,
            snapshots_aged.age_days,
            snapshots_aged.engagements
           FROM metrics.snapshots_aged
          WHERE snapshots_aged.content_type <> 'stories'::text
          ORDER BY snapshots_aged.brand_id, snapshots_aged.network, snapshots_aged.content_type, snapshots_aged.external_id, snapshots_aged.captured_on DESC
        ), med AS (
         SELECT l_1.brand_id,
            l_1.network,
            l_1.content_type,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (l_1.views::double precision)) AS median_views,
            count(*) AS n
           FROM latest l_1
             LEFT JOIN metrics.post_assist pa_1 ON pa_1.external_id = l_1.external_id
          WHERE pa_1.external_id IS NULL
          GROUP BY l_1.brand_id, l_1.network, l_1.content_type
        )
 SELECT l.external_id,
    br.name AS brand_name,
    br.brand_type,
    br.owner,
    bln.labels,
    l.network,
    l.content_type,
    l.caption,
    l.permalink,
    l.thumbnail_url,
    l.published_at,
    l.age_days,
    l.views,
    l.likes,
    l.comments,
    l.shares,
    l.saves,
    l.engagement_pct,
    l.skip_rate,
    l.avg_watch_seconds,
    m.median_views,
    round((l.views::double precision / NULLIF(m.median_views, 0::double precision))::numeric, 1) AS views_multiple,
    m.n AS sample_size,
    pa.assisted_from,
    pa.assist_kinds,
    pa.assisted_from IS NOT NULL AS is_assisted,
    l.follows,
    l.reach,
    l.duration_seconds
   FROM latest l
     JOIN med m ON m.brand_id = l.brand_id AND m.network = l.network AND m.content_type = l.content_type
     JOIN metrics.brands br ON br.id = l.brand_id
     JOIN metrics.brand_label_names bln ON bln.brand_id = br.id
     LEFT JOIN metrics.post_assist pa ON pa.external_id = l.external_id;

create or replace view metrics.post_engagement as
 SELECT sp.external_id,
    sp.brand_name,
    sp.brand_type,
    sp.owner,
    sp.labels,
    sp.network,
    sp.content_type,
    sp.caption,
    sp.permalink,
    sp.thumbnail_url,
    sp.published_at,
    sp.age_days,
    sp.views,
    sp.likes,
    sp.comments,
    sp.shares,
    sp.saves,
    sp.engagement_pct,
    sp.skip_rate,
    sp.avg_watch_seconds,
    sp.median_views,
    sp.views_multiple,
    sp.sample_size,
    sp.assisted_from,
    sp.assist_kinds,
    sp.is_assisted,
    sp.follows,
    sp.reach,
    sp.duration_seconds,
    COALESCE(sp.likes, 0::bigint) + COALESCE(sp.comments, 0::bigint) * 3 + COALESCE(sp.saves, 0::bigint) * 5 + COALESCE(sp.shares, 0::bigint) * 5 + COALESCE(sp.follows, 0::bigint) * 10 AS weighted_engagement,
        CASE
            WHEN sp.views > 0 THEN round(100.0 * (COALESCE(sp.likes, 0::bigint) + COALESCE(sp.comments, 0::bigint) * 3 + COALESCE(sp.saves, 0::bigint) * 5 + COALESCE(sp.shares, 0::bigint) * 5 + COALESCE(sp.follows, 0::bigint) * 10)::numeric / sp.views::numeric, 2)
            ELSE NULL::numeric
        END AS engagement_rate,
        CASE
            WHEN sp.duration_seconds > 0::numeric AND sp.avg_watch_seconds IS NOT NULL THEN round(100.0 * sp.avg_watch_seconds / sp.duration_seconds, 1)
            ELSE NULL::numeric
        END AS completion_pct
   FROM metrics.scored_posts sp;

-- CREATE OR REPLACE VIEW should preserve reloptions, but set these explicitly:
-- if security_invoker were ever lost, the RLS boundary on the metrics base
-- tables would silently stop applying to these views.
alter view metrics.scored_posts   set (security_invoker = true);
alter view metrics.post_engagement set (security_invoker = true);

-- Equivalence gate. Any difference raises, which aborts the migration and rolls
-- back both view definitions rather than leaving the change half-applied.
do $$
declare
  v_md5 text; v_rows bigint;
  v_pd bigint; v_bps bigint; v_best bigint; v_leading bigint; v_flagged bigint;
  v_si_scored text; v_si_pe text;
begin
  select md5(string_agg(t::text, '|' order by t.external_id, t.network, t.content_type)), count(*)
    into v_md5, v_rows from metrics.post_engagement t;

  select count(*) into v_pd      from public.mx_post_detail;
  select count(*) into v_bps     from public.mx_brand_platform_summary;
  select count(*) into v_best    from public.mx_best;
  select count(*) into v_leading from public.mx_leading;
  select count(*) into v_flagged from public.mx_flagged;

  select coalesce((select option_value from pg_options_to_table(c.reloptions)
                   where option_name='security_invoker'),'NOT SET')
    into v_si_scored
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='metrics' and c.relname='scored_posts';

  select coalesce((select option_value from pg_options_to_table(c.reloptions)
                   where option_name='security_invoker'),'NOT SET')
    into v_si_pe
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='metrics' and c.relname='post_engagement';

  if v_md5 is distinct from 'fd7d3ea5b3b2750519917f64189839b4' then
    raise exception 'post_engagement md5 changed: got %, expected fd7d3ea5b3b2750519917f64189839b4', v_md5;
  end if;
  if v_rows <> 596 then raise exception 'post_engagement rows: got %, expected 596', v_rows; end if;
  if v_pd <> 596 then raise exception 'mx_post_detail: got %, expected 596', v_pd; end if;
  if v_bps <> 29 then raise exception 'mx_brand_platform_summary: got %, expected 29', v_bps; end if;
  if v_best <> 23 then raise exception 'mx_best: got %, expected 23', v_best; end if;
  if v_leading <> 10 then raise exception 'mx_leading: got %, expected 10', v_leading; end if;
  if v_flagged <> 0 then raise exception 'mx_flagged: got %, expected 0', v_flagged; end if;
  if v_si_scored <> 'true' then raise exception 'scored_posts security_invoker = %', v_si_scored; end if;
  if v_si_pe <> 'true' then raise exception 'post_engagement security_invoker = %', v_si_pe; end if;

  raise notice 'equivalence verified: md5 %, 596 rows, security_invoker preserved', v_md5;
end $$;
