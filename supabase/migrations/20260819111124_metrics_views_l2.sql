create or replace view metrics.flagged_posts_interim as 
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
    l.network,
    l.content_type,
    l.caption,
    l.permalink,
    l.thumbnail_url,
    l.published_at,
    l.age_days,
    l.views,
    m.median_views,
    round((l.views::double precision / NULLIF(m.median_views, 0::double precision))::numeric, 1) AS views_multiple,
    l.engagement_pct,
    l.skip_rate,
    l.avg_watch_seconds,
    m.n AS sample_size,
    pa.assisted_from,
    pa.assist_kinds,
    pa.assisted_from IS NOT NULL AS is_assisted
   FROM latest l
     JOIN med m ON m.brand_id = l.brand_id AND m.network = l.network AND m.content_type = l.content_type
     JOIN metrics.brands br ON br.id = l.brand_id
     LEFT JOIN metrics.post_assist pa ON pa.external_id = l.external_id
  WHERE m.n >= 10 AND m.median_views > 0::double precision AND l.views::double precision >= (m.median_views * 2.5::double precision) AND l.published_at >= (now() - '30 days'::interval);

create or replace view metrics.monthly_by_owner as 
 WITH at_14 AS (
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
          WHERE snapshots_aged.age_days >= 12 AND snapshots_aged.age_days <= 16 AND snapshots_aged.content_type <> 'stories'::text
          ORDER BY snapshots_aged.brand_id, snapshots_aged.network, snapshots_aged.content_type, snapshots_aged.external_id, snapshots_aged.age_days
        )
 SELECT date_trunc('month'::text, a.published_at)::date AS month,
    br.owner,
    count(*) AS posts,
    sum(a.views) AS total_views,
    sum(a.engagements) AS total_engagements
   FROM at_14 a
     JOIN metrics.brands br ON br.id = a.brand_id
  WHERE br.brand_type = 'theme'::text
  GROUP BY (date_trunc('month'::text, a.published_at)::date), br.owner;

create or replace view metrics.monthly_by_owner_relative as 
 WITH monthly AS (
         SELECT date_trunc('month'::text, a.published_at)::date AS month,
            a.brand_id,
            br.owner,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (a.views::double precision)) AS median_views
           FROM metrics.snapshots_aged a
             JOIN metrics.brands br ON br.id = a.brand_id
          WHERE br.brand_type = 'theme'::text AND a.age_days >= 12 AND a.age_days <= 16 AND a.content_type <> 'stories'::text
          GROUP BY (date_trunc('month'::text, a.published_at)::date), a.brand_id, br.owner
        ), growth AS (
         SELECT monthly.month,
            monthly.owner,
            monthly.brand_id,
            monthly.median_views / NULLIF(lag(monthly.median_views) OVER (PARTITION BY monthly.brand_id ORDER BY monthly.month), 0::double precision) AS multiple
           FROM monthly
        )
 SELECT month,
    owner,
    round(avg(multiple)::numeric, 2) AS growth_multiple
   FROM growth
  WHERE multiple IS NOT NULL
  GROUP BY month, owner;

create or replace view metrics.movers as 
 WITH ranked AS (
         SELECT s.id,
            s.brand_id,
            s.network,
            s.content_type,
            s.external_id,
            s.captured_on,
            s.published_at,
            s.permalink,
            s.caption,
            s.thumbnail_url,
            s.views,
            s.reach,
            s.likes,
            s.comments,
            s.shares,
            s.saves,
            s.follows,
            s.engagement_pct,
            s.avg_watch_seconds,
            s.duration_seconds,
            s.skip_rate,
            s.reposts,
            s.payload,
            s.age_days,
            s.engagements,
            row_number() OVER (PARTITION BY s.brand_id, s.network, s.content_type, s.external_id ORDER BY s.captured_on DESC) AS rn
           FROM metrics.snapshots_aged s
          WHERE s.content_type <> 'stories'::text
        )
 SELECT cur.external_id,
    br.name AS brand_name,
    br.brand_type,
    bln.labels,
    cur.network,
    cur.content_type,
    cur.caption,
    cur.permalink,
    cur.thumbnail_url,
    cur.published_at,
    cur.age_days,
    cur.captured_on AS captured_now,
    prev.captured_on AS captured_prev,
    cur.views AS views_now,
    prev.views AS views_prev,
    cur.views - prev.views AS views_gained,
        CASE
            WHEN prev.views > 0 THEN round(100.0 * (cur.views - prev.views)::numeric / prev.views::numeric, 1)
            ELSE NULL::numeric
        END AS views_pct_change
   FROM ranked cur
     JOIN ranked prev ON prev.external_id = cur.external_id AND prev.network = cur.network AND prev.content_type = cur.content_type AND prev.brand_id = cur.brand_id AND prev.rn = 2
     JOIN metrics.brands br ON br.id = cur.brand_id
     JOIN metrics.brand_label_names bln ON bln.brand_id = br.id
  WHERE cur.rn = 1;

create or replace view metrics.post_baselines as 
 SELECT a.id,
    a.brand_id,
    a.network,
    a.content_type,
    a.external_id,
    a.captured_on,
    a.published_at,
    a.permalink,
    a.caption,
    a.thumbnail_url,
    a.views,
    a.reach,
    a.likes,
    a.comments,
    a.shares,
    a.saves,
    a.follows,
    a.engagement_pct,
    a.avg_watch_seconds,
    a.duration_seconds,
    a.skip_rate,
    a.reposts,
    a.payload,
    a.age_days,
    a.engagements,
    pa.assisted_from,
    pa.assist_kinds,
    pa.assisted_from IS NOT NULL AND a.captured_on >= pa.assisted_from AS is_assisted,
    b.median_views,
    b.median_engagements,
    b.sample_size
   FROM metrics.snapshots_aged a
     LEFT JOIN metrics.post_assist pa ON pa.external_id = a.external_id
     LEFT JOIN LATERAL ( SELECT percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (p.views::double precision)) AS median_views,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (p.engagements::double precision)) AS median_engagements,
            count(*) AS sample_size
           FROM ( SELECT p2.views,
                    p2.engagements
                   FROM metrics.snapshots_aged p2
                     LEFT JOIN metrics.post_assist pa2 ON pa2.external_id = p2.external_id
                  WHERE p2.brand_id = a.brand_id AND p2.network = a.network AND p2.content_type = a.content_type AND p2.external_id <> a.external_id AND p2.published_at < a.published_at AND p2.age_days = a.age_days AND pa2.external_id IS NULL
                  ORDER BY p2.published_at DESC
                 LIMIT 20) p) b ON true;

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
    pa.assisted_from IS NOT NULL AS is_assisted
   FROM latest l
     JOIN med m ON m.brand_id = l.brand_id AND m.network = l.network AND m.content_type = l.content_type
     JOIN metrics.brands br ON br.id = l.brand_id
     JOIN metrics.brand_label_names bln ON bln.brand_id = br.id
     LEFT JOIN metrics.post_assist pa ON pa.external_id = l.external_id;
