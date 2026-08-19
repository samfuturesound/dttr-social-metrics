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
     JOIN metrics.post_detail_mv pd ON pd.brand_id = br.id
  GROUP BY br.id, br.name, br.brand_type, bln.labels, pd.network, pd.content_type;

alter view metrics.brand_platform_summary set (security_invoker = true);
grant select on metrics.post_detail_mv to authenticated;
grant select on metrics.brand_platform_summary to authenticated;
