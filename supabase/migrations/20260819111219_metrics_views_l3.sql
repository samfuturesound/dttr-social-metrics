create or replace view metrics.account_scores as 
 SELECT br.name AS brand_name,
    br.brand_type,
    br.owner,
    bln.labels,
    count(sp.external_id) AS posts,
    round(sum(sp.views_multiple), 1) AS total_score,
    round(avg(sp.views_multiple), 1) AS avg_multiple,
    sum(sp.views) AS total_views,
    max(sp.views_multiple) AS best_multiple
   FROM metrics.brands br
     JOIN metrics.brand_label_names bln ON bln.brand_id = br.id
     LEFT JOIN metrics.scored_posts sp ON sp.brand_name = br.name AND sp.published_at >= (now() - '30 days'::interval)
  WHERE br.active
  GROUP BY br.name, br.brand_type, br.owner, bln.labels
 HAVING count(sp.external_id) > 0
  ORDER BY (round(sum(sp.views_multiple), 1)) DESC NULLS LAST
 LIMIT 20;

create or replace view metrics.alerts as 
 WITH ranked AS (
         SELECT s.brand_id,
            s.network,
            s.content_type,
            s.external_id,
            s.captured_on,
            s.published_at,
            s.caption,
            s.permalink,
            s.thumbnail_url,
            s.age_days,
            s.views,
            row_number() OVER (PARTITION BY s.brand_id, s.network, s.content_type, s.external_id ORDER BY s.captured_on DESC) AS rn
           FROM metrics.snapshots_aged s
          WHERE s.content_type <> 'stories'::text AND s.published_at >= (now() - '30 days'::interval)
        ), pair AS (
         SELECT cur.brand_id,
            cur.network,
            cur.content_type,
            cur.external_id,
            cur.published_at,
            cur.caption,
            cur.permalink,
            cur.thumbnail_url,
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
             JOIN ranked prev USING (brand_id, network, content_type, external_id)
          WHERE cur.rn = 1 AND prev.rn = 2
        )
 SELECT p.external_id,
    br.name AS brand_name,
    br.brand_type,
    bln.labels,
    p.network,
    p.content_type,
    p.caption,
    p.permalink,
    p.thumbnail_url,
    p.published_at,
    p.age_days,
    p.captured_now,
    p.captured_prev,
    p.views_prev,
    p.views_now,
    p.views_gained,
    p.views_pct_change,
    sp.views_multiple,
    sp.median_views,
    round((p.views_prev::double precision / NULLIF(sp.median_views, 0::double precision))::numeric, 1) AS multiple_prev,
    'breakout'::text AS reason
   FROM pair p
     JOIN metrics.brands br ON br.id = p.brand_id
     JOIN metrics.brand_label_names bln ON bln.brand_id = br.id
     JOIN metrics.scored_posts sp ON sp.external_id = p.external_id AND sp.network = p.network AND sp.content_type = p.content_type
  WHERE sp.sample_size >= 10 AND p.views_now >= 10000 AND sp.views_multiple >= 2.5 AND NOT (p.views_prev >= 10000 AND COALESCE(p.views_prev::double precision / NULLIF(sp.median_views, 0::double precision), 0::double precision) >= 2.5::double precision);

create or replace view metrics.best_posts as 
 SELECT external_id,
    brand_name,
    brand_type,
    owner,
    labels,
    network,
    content_type,
    caption,
    permalink,
    thumbnail_url,
    published_at,
    age_days,
    views,
    likes,
    comments,
    shares,
    saves,
    engagement_pct,
    skip_rate,
    avg_watch_seconds,
    median_views,
    views_multiple,
    sample_size,
    assisted_from,
    assist_kinds,
    is_assisted
   FROM metrics.scored_posts
  WHERE sample_size >= 10 AND median_views > 0::double precision AND views::double precision >= (median_views * 2.5::double precision) AND published_at >= (now() - '6 mons'::interval);

create or replace view metrics.digest_leading as 
 SELECT brand_name,
    brand_type,
    network,
    content_type,
    published_at::date AS published,
    views,
    views_multiple,
    median_views,
    permalink,
    skip_rate,
    "left"(COALESCE(caption, ''::text), 160) AS caption
   FROM metrics.scored_posts sp
  WHERE published_at >= (now() - '14 days'::interval) AND sample_size >= 10 AND median_views > 0::double precision
  ORDER BY views_multiple DESC NULLS LAST
 LIMIT 8;

create or replace view metrics.flagged_posts as 
 SELECT DISTINCT ON (pb.brand_id, pb.network, pb.content_type, pb.external_id) pb.external_id,
    br.name AS brand_name,
    br.brand_type,
    br.owner,
    pb.network,
    pb.content_type,
    pb.caption,
    pb.permalink,
    pb.thumbnail_url,
    pb.published_at,
    pb.age_days,
    pb.views,
    pb.median_views,
    round((pb.views::double precision / NULLIF(pb.median_views, 0::double precision))::numeric, 1) AS views_multiple,
    pb.engagements,
    pb.engagement_pct,
    pb.skip_rate,
    pb.avg_watch_seconds,
    pb.sample_size,
    pb.assisted_from,
    pb.assist_kinds,
    pb.is_assisted
   FROM metrics.post_baselines pb
     JOIN metrics.brands br ON br.id = pb.brand_id
  WHERE pb.content_type <> 'stories'::text AND pb.sample_size >= 10 AND pb.median_views > 0::double precision AND pb.views::double precision >= (pb.median_views * 2.5::double precision) AND pb.published_at >= (now() - '30 days'::interval)
  ORDER BY pb.brand_id, pb.network, pb.content_type, pb.external_id, pb.captured_on DESC;

create or replace view metrics.leading_posts as 
 SELECT external_id,
    brand_name,
    brand_type,
    owner,
    labels,
    network,
    content_type,
    caption,
    permalink,
    thumbnail_url,
    published_at,
    age_days,
    views,
    likes,
    comments,
    shares,
    saves,
    engagement_pct,
    skip_rate,
    avg_watch_seconds,
    median_views,
    views_multiple,
    sample_size,
    assisted_from,
    assist_kinds,
    is_assisted
   FROM metrics.scored_posts
  WHERE published_at >= (now() - '30 days'::interval) AND sample_size >= 10 AND median_views > 0::double precision
  ORDER BY views_multiple DESC NULLS LAST
 LIMIT 10;

create or replace view metrics.post_engagement as 
 WITH extras AS (
         SELECT DISTINCT ON (snapshots_aged.brand_id, snapshots_aged.network, snapshots_aged.content_type, snapshots_aged.external_id) snapshots_aged.external_id,
            snapshots_aged.network,
            snapshots_aged.content_type,
            snapshots_aged.follows,
            snapshots_aged.reach,
            snapshots_aged.duration_seconds
           FROM metrics.snapshots_aged
          ORDER BY snapshots_aged.brand_id, snapshots_aged.network, snapshots_aged.content_type, snapshots_aged.external_id, snapshots_aged.captured_on DESC
        )
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
    e.follows,
    e.reach,
    e.duration_seconds,
    COALESCE(sp.likes, 0::bigint) + COALESCE(sp.comments, 0::bigint) * 3 + COALESCE(sp.saves, 0::bigint) * 5 + COALESCE(sp.shares, 0::bigint) * 5 + COALESCE(e.follows, 0::bigint) * 10 AS weighted_engagement,
        CASE
            WHEN sp.views > 0 THEN round(100.0 * (COALESCE(sp.likes, 0::bigint) + COALESCE(sp.comments, 0::bigint) * 3 + COALESCE(sp.saves, 0::bigint) * 5 + COALESCE(sp.shares, 0::bigint) * 5 + COALESCE(e.follows, 0::bigint) * 10)::numeric / sp.views::numeric, 2)
            ELSE NULL::numeric
        END AS engagement_rate,
        CASE
            WHEN e.duration_seconds > 0::numeric AND sp.avg_watch_seconds IS NOT NULL THEN round(100.0 * sp.avg_watch_seconds / e.duration_seconds, 1)
            ELSE NULL::numeric
        END AS completion_pct
   FROM metrics.scored_posts sp
     LEFT JOIN extras e ON e.external_id = sp.external_id AND e.network = sp.network AND e.content_type = sp.content_type;

create or replace view metrics.recent_posts as 
 SELECT external_id,
    brand_name,
    brand_type,
    owner,
    labels,
    network,
    content_type,
    caption,
    permalink,
    thumbnail_url,
    published_at,
    age_days,
    views,
    likes,
    comments,
    shares,
    saves,
    engagement_pct,
    skip_rate,
    avg_watch_seconds,
    median_views,
    views_multiple,
    sample_size,
    assisted_from,
    assist_kinds,
    is_assisted,
    rn
   FROM ( SELECT sp.external_id,
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
            row_number() OVER (PARTITION BY sp.brand_type ORDER BY sp.published_at DESC) AS rn
           FROM metrics.scored_posts sp) t
  WHERE rn <= 60;

create or replace view metrics.top_by_views as 
 SELECT external_id,
    brand_name,
    brand_type,
    owner,
    labels,
    network,
    content_type,
    caption,
    permalink,
    thumbnail_url,
    published_at,
    age_days,
    views,
    likes,
    comments,
    shares,
    saves,
    engagement_pct,
    skip_rate,
    avg_watch_seconds,
    median_views,
    views_multiple,
    sample_size,
    assisted_from,
    assist_kinds,
    is_assisted
   FROM metrics.scored_posts
  WHERE published_at >= (now() - '30 days'::interval)
  ORDER BY views DESC NULLS LAST
 LIMIT 10;
