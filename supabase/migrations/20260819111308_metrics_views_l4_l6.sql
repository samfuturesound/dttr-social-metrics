create or replace view metrics.digest as 
 SELECT ( SELECT count(*) AS count
           FROM metrics.scored_posts
          WHERE scored_posts.published_at >= (now() - '14 days'::interval)) AS posts_14d,
    ( SELECT sum(scored_posts.views) AS sum
           FROM metrics.scored_posts
          WHERE scored_posts.published_at >= (now() - '14 days'::interval)) AS views_14d,
    ( SELECT count(*) AS count
           FROM metrics.alerts) AS live_alerts,
    ( SELECT count(*) AS count
           FROM metrics.scored_posts
          WHERE scored_posts.published_at >= (now() - '14 days'::interval) AND scored_posts.views_multiple >= 2.5) AS above_baseline_14d,
    ( SELECT max(raw_snapshots.captured_on) AS max
           FROM metrics.raw_snapshots) AS last_pull;

create or replace view metrics.post_detail as 
 WITH med AS (
         SELECT post_engagement.brand_name,
            post_engagement.network,
            post_engagement.content_type,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (post_engagement.engagement_rate::double precision)) FILTER (WHERE post_engagement.engagement_rate IS NOT NULL) AS median_engagement_rate,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (post_engagement.completion_pct::double precision)) FILTER (WHERE post_engagement.completion_pct IS NOT NULL) AS median_completion_pct
           FROM metrics.post_engagement
          GROUP BY post_engagement.brand_name, post_engagement.network, post_engagement.content_type
        )
 SELECT pe.external_id,
    pe.brand_name,
    pe.brand_type,
    pe.owner,
    pe.labels,
    pe.network,
    pe.content_type,
    pe.caption,
    pe.permalink,
    pe.thumbnail_url,
    pe.published_at,
    pe.age_days,
    pe.views,
    pe.likes,
    pe.comments,
    pe.shares,
    pe.saves,
    pe.engagement_pct,
    pe.skip_rate,
    pe.avg_watch_seconds,
    pe.median_views,
    pe.views_multiple,
    pe.sample_size,
    pe.assisted_from,
    pe.assist_kinds,
    pe.is_assisted,
    pe.follows,
    pe.reach,
    pe.duration_seconds,
    pe.weighted_engagement,
    pe.engagement_rate,
    pe.completion_pct,
    m.median_engagement_rate,
    m.median_completion_pct,
    round((pe.engagement_rate::double precision / NULLIF(m.median_engagement_rate, 0::double precision))::numeric, 1) AS engagement_multiple
   FROM metrics.post_engagement pe
     LEFT JOIN med m ON m.brand_name = pe.brand_name AND m.network = pe.network AND m.content_type = pe.content_type;

create or replace view metrics.brand_platform_summary as 
 SELECT br.id AS brand_id,
    br.name AS brand_name,
    br.brand_type,
    bln.labels,
    pd.network,
    pd.content_type,
    count(pd.external_id) AS posts,
    sum(pd.views) AS views,
    round(percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (pd.views::double precision))::numeric, 0) AS median_views,
    round(percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (pd.engagement_rate::double precision))::numeric, 2) AS median_engagement_rate,
    round(percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (pd.completion_pct::double precision))::numeric, 1) AS median_completion_pct,
    count(pd.completion_pct) AS completion_available,
    max(pd.published_at)::date AS last_post
   FROM metrics.brands br
     JOIN metrics.brand_label_names bln ON bln.brand_id = br.id
     JOIN metrics.post_detail pd ON pd.brand_name = br.name
  GROUP BY br.id, br.name, br.brand_type, bln.labels, pd.network, pd.content_type;

create or replace view metrics.brand_skip_rates as 
 SELECT brand_name,
    network,
    content_type,
    count(*) FILTER (WHERE skip_rate IS NOT NULL) AS reels_counted,
    percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (skip_rate::double precision)) FILTER (WHERE skip_rate IS NOT NULL) AS median_skip_rate
   FROM metrics.post_detail pd
  WHERE skip_rate IS NOT NULL
  GROUP BY brand_name, network, content_type;

create or replace view metrics.brand_summary as 
 SELECT br.id AS brand_id,
    br.name AS brand_name,
    br.brand_type,
    br.owner,
    br.niche,
    br.active,
    br.metricool_blog_id,
    bln.labels,
    count(pd.external_id) AS posts_all_time,
    sum(pd.views) AS views_all_time,
    count(pd.external_id) FILTER (WHERE pd.published_at >= (now() - '3 mons'::interval)) AS posts_3m,
    sum(pd.views) FILTER (WHERE pd.published_at >= (now() - '3 mons'::interval)) AS views_3m,
    round(percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (pd.views::double precision))::numeric, 0) AS median_views,
    round(percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (pd.engagement_rate::double precision))::numeric, 2) AS median_engagement_rate,
    round(percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (pd.completion_pct::double precision))::numeric, 1) AS median_completion_pct,
    min(pd.published_at)::date AS first_post,
    max(pd.published_at)::date AS last_post
   FROM metrics.brands br
     JOIN metrics.brand_label_names bln ON bln.brand_id = br.id
     LEFT JOIN metrics.post_detail pd ON pd.brand_name = br.name
  GROUP BY br.id, br.name, br.brand_type, br.owner, br.niche, br.active, br.metricool_blog_id, bln.labels;

create or replace view metrics.skip_roster as 
 SELECT count(*) AS reels_counted,
    percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (skip_rate::double precision)) AS roster_median,
    min(skip_rate) AS best_skip_rate,
    max(skip_rate) AS worst_skip_rate
   FROM metrics.post_detail
  WHERE skip_rate IS NOT NULL;

create or replace view metrics.brand_platform_ranks as 
 WITH r AS (
         SELECT s.brand_id,
            s.brand_name,
            s.brand_type,
            s.labels,
            s.network,
            s.content_type,
            s.posts,
            s.views,
            s.median_views,
            s.median_engagement_rate,
            s.median_completion_pct,
            s.completion_available,
            s.last_post,
            rank() OVER (PARTITION BY s.network, s.content_type ORDER BY s.median_views DESC NULLS LAST) AS rv_all,
            count(s.median_views) OVER (PARTITION BY s.network, s.content_type) AS tv_all,
            rank() OVER (PARTITION BY s.network, s.content_type, s.brand_type ORDER BY s.median_views DESC NULLS LAST) AS rv_type,
            count(s.median_views) OVER (PARTITION BY s.network, s.content_type, s.brand_type) AS tv_type,
            rank() OVER (PARTITION BY s.network, s.content_type ORDER BY s.median_engagement_rate DESC NULLS LAST) AS re_all,
            count(s.median_engagement_rate) OVER (PARTITION BY s.network, s.content_type) AS te_all,
            rank() OVER (PARTITION BY s.network, s.content_type, s.brand_type ORDER BY s.median_engagement_rate DESC NULLS LAST) AS re_type,
            count(s.median_engagement_rate) OVER (PARTITION BY s.network, s.content_type, s.brand_type) AS te_type,
            rank() OVER (PARTITION BY s.network, s.content_type ORDER BY s.median_completion_pct DESC NULLS LAST) AS rc_all,
            count(s.median_completion_pct) OVER (PARTITION BY s.network, s.content_type) AS tc_all,
            rank() OVER (PARTITION BY s.network, s.content_type, s.brand_type ORDER BY s.median_completion_pct DESC NULLS LAST) AS rc_type,
            count(s.median_completion_pct) OVER (PARTITION BY s.network, s.content_type, s.brand_type) AS tc_type
           FROM metrics.brand_platform_summary s
        )
 SELECT brand_id,
    brand_name,
    brand_type,
    labels,
    network,
    content_type,
    posts,
    views,
    median_views,
    median_engagement_rate,
    median_completion_pct,
    completion_available,
    last_post,
        CASE
            WHEN tv_all > 0 AND median_views IS NOT NULL THEN rv_all
            ELSE NULL::bigint
        END AS rank_views_all,
    tv_all AS total_views_all,
        CASE
            WHEN tv_type > 0 AND median_views IS NOT NULL THEN rv_type
            ELSE NULL::bigint
        END AS rank_views_type,
    tv_type AS total_views_type,
        CASE
            WHEN te_all > 0 AND median_engagement_rate IS NOT NULL THEN re_all
            ELSE NULL::bigint
        END AS rank_eng_all,
    te_all AS total_eng_all,
        CASE
            WHEN te_type > 0 AND median_engagement_rate IS NOT NULL THEN re_type
            ELSE NULL::bigint
        END AS rank_eng_type,
    te_type AS total_eng_type,
        CASE
            WHEN tc_all > 0 AND median_completion_pct IS NOT NULL THEN rc_all
            ELSE NULL::bigint
        END AS rank_completion_all,
    tc_all AS total_completion_all,
        CASE
            WHEN tc_type > 0 AND median_completion_pct IS NOT NULL THEN rc_type
            ELSE NULL::bigint
        END AS rank_completion_type,
    tc_type AS total_completion_type
   FROM r;
