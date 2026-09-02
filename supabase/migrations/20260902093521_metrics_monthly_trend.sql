-- Monthly trend series for the bottom-of-page charts.
--
-- Three design decisions are baked in here deliberately:
--
-- 1. MATURITY. Views on every platform are effectively frozen 30 days after
--    publication (measured: TikTok +0.7%, IG posts +0.1%, IG reels +0.2% over
--    a 24-day window for posts already 30d+ old, versus +35/34/53% for posts
--    under 14 days). A month is therefore only plotted once it ended at least
--    30 days ago. Without this the newest point always droops and reads as a
--    decline that isn't there.
--
-- 2. MINIMUM SAMPLE. A month needs 3+ posts to produce a median. Below that
--    the "median" is one post. Months under the threshold are absent, not
--    zero -- the frontend must draw a gap, never interpolate across it.
--
-- 3. PER PLATFORM. network + content_type stay in the grain. Pooling TikTok
--    with Instagram posts and reels destroys the comparison, which is the
--    same reason brand_platform_summary is split.
--
-- growth_multiple is this month's median views over last month's, and is
-- null unless the immediately preceding month is also present -- it must
-- never bridge a gap.

create or replace view metrics.monthly_trend
with (security_invoker = true) as
with cal as (
  -- Most recent fully-settled month.
  select date_trunc('month', now() - interval '30 days' - interval '1 month')::date as last_month
),
agg as (
  select pd.brand_id,
         pd.brand_name,
         pd.brand_type,
         pd.labels,
         pd.network,
         pd.content_type,
         date_trunc('month', pd.published_at)::date as month,
         count(*)::bigint as posts,
         percentile_cont(0.5) within group (order by pd.views::double precision) as median_views,
         percentile_cont(0.5) within group (order by pd.engagement_rate::double precision) as median_engagement_rate
  from metrics.post_detail_mv pd, cal
  where pd.content_type <> 'stories'
    and date_trunc('month', pd.published_at)::date
        between cal.last_month - interval '6 months' and cal.last_month
  group by 1,2,3,4,5,6,7
  having count(*) >= 3
),
g as (
  select a.*,
         lag(a.median_views) over w as prev_median_views,
         lag(a.month)        over w as prev_month
  from agg a
  window w as (partition by a.brand_id, a.network, a.content_type order by a.month)
)
select g.brand_id,
       g.brand_name,
       g.brand_type,
       g.labels,
       g.network,
       g.content_type,
       g.month,
       g.posts,
       round(g.median_views::numeric, 0)            as median_views,
       round(g.median_engagement_rate::numeric, 2)  as median_engagement_rate,
       case
         when g.prev_month = (g.month - interval '1 month')::date
         then round((g.median_views / nullif(g.prev_median_views, 0))::numeric, 2)
       end as growth_multiple
from g, cal
where g.month >= cal.last_month - interval '5 months';

comment on view metrics.monthly_trend is
  'Monthly medians by brand and platform, last 6 fully-settled months. Months end at least 30 days ago and carry 3+ posts. See migration comment before changing the maturity or sample thresholds.';

grant select on metrics.monthly_trend to authenticated, service_role;
