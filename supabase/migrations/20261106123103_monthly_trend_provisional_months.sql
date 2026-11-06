-- The original settle rule required a whole month to be 30 days past its END
-- before charting it. In practice that hides the two most recent months: on
-- 6 November the newest point was September, with 206 October posts across
-- 10 brands already collected and invisible.
--
-- New rule: a month is charted once it has ENDED. Months whose end is less
-- than 30 days ago are flagged is_provisional, because views are still
-- accumulating on their youngest posts and the median will drift upward as
-- they settle. The frontend must draw provisional points differently
-- (dashed) and say so -- an unmarked provisional point reads as a decline
-- that isn't real, which is the whole reason the strict rule existed.
--
-- is_provisional is appended last: CREATE OR REPLACE VIEW can add a trailing
-- column but cannot insert one mid-list.

create or replace view metrics.monthly_trend
with (security_invoker = true) as
with cal as (
  select (date_trunc('month', now()) - interval '1 month')::date as last_month,
         date_trunc('month', now() - interval '30 days' - interval '1 month')::date as settled_through
),
agg as (
  select pd.brand_id,
         pd.brand_name,
         pd.brand_type,
         pd.labels,
         pd.network,
         pd.content_type,
         date_trunc('month', pd.published_at)::date as month,
         count(*) filter (where not coalesce(pd.is_assisted, false))::bigint as posts,
         count(*) filter (where coalesce(pd.is_assisted, false))::bigint      as paid_excluded,
         percentile_cont(0.5) within group (order by pd.views::double precision)
           filter (where not coalesce(pd.is_assisted, false)) as median_views,
         percentile_cont(0.5) within group (order by pd.engagement_rate::double precision)
           filter (where not coalesce(pd.is_assisted, false)) as median_engagement_rate
  from metrics.post_detail_mv pd, cal
  where pd.content_type <> 'stories'
    and date_trunc('month', pd.published_at)::date
        between cal.last_month - interval '6 months' and cal.last_month
  group by 1,2,3,4,5,6,7
  having count(*) filter (where not coalesce(pd.is_assisted, false)) >= 3
),
g as (
  select a.*,
         lag(a.median_views) over w as prev_median_views,
         lag(a.month)        over w as prev_month
  from agg a
  window w as (partition by a.brand_id, a.network, a.content_type order by a.month)
)
select g.brand_id, g.brand_name, g.brand_type, g.labels,
       g.network, g.content_type, g.month, g.posts,
       round(g.median_views::numeric, 0)           as median_views,
       round(g.median_engagement_rate::numeric, 2) as median_engagement_rate,
       case
         when g.prev_month = (g.month - interval '1 month')::date
         then round((g.median_views / nullif(g.prev_median_views, 0))::numeric, 2)
       end as growth_multiple,
       g.paid_excluded,
       (g.month > cal.settled_through) as is_provisional
from g, cal
where g.month >= cal.last_month - interval '5 months';

comment on view metrics.monthly_trend is
  'Organic monthly medians by brand and platform, last 6 ended months. Paid posts excluded. Months ended under 30 days ago are flagged is_provisional and will drift upward as views settle.';

grant select on metrics.monthly_trend to authenticated, service_role;

create or replace view public.mx_trend
with (security_invoker = true) as
  select brand_id, brand_name, brand_type, labels, network, content_type,
         month, posts, median_views, median_engagement_rate, growth_multiple,
         paid_excluded, is_provisional
  from metrics.monthly_trend;

grant select on public.mx_trend to authenticated, service_role;

drop function if exists public.mx_share_trend(text);
drop function if exists public.mx_label_share_trend(text);

create function public.mx_share_trend(p_token text)
returns table (
  network text, content_type text, month date, posts bigint,
  median_views numeric, median_engagement_rate numeric, growth_multiple numeric,
  paid_excluded bigint, is_provisional boolean
)
language sql stable security definer set search_path = metrics, public as $$
  select t.network, t.content_type, t.month, t.posts,
         t.median_views, t.median_engagement_rate, t.growth_multiple,
         t.paid_excluded, t.is_provisional
  from metrics.monthly_trend t
  where t.brand_id = public.mx_share_brand_id(p_token)
    and public.mx_share_brand_id(p_token) is not null
  order by t.network, t.content_type, t.month;
$$;

create function public.mx_label_share_trend(p_token text)
returns table (
  brand_name text, network text, content_type text, month date, posts bigint,
  median_views numeric, median_engagement_rate numeric, growth_multiple numeric,
  paid_excluded bigint, is_provisional boolean
)
language sql stable security definer set search_path = metrics, public as $$
  select t.brand_name, t.network, t.content_type, t.month, t.posts,
         t.median_views, t.median_engagement_rate, t.growth_multiple,
         t.paid_excluded, t.is_provisional
  from metrics.monthly_trend t
  where public.mx_label_share_name(p_token) = any(t.labels)
    and public.mx_label_share_name(p_token) is not null
  order by t.brand_name, t.network, t.content_type, t.month;
$$;

revoke execute on function public.mx_share_trend(text) from public, anon;
revoke execute on function public.mx_label_share_trend(text) from public, anon;
grant execute on function public.mx_share_trend(text) to anon, authenticated, service_role;
grant execute on function public.mx_label_share_trend(text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
