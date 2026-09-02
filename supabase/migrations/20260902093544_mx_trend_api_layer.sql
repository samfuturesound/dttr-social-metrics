-- API layer for the monthly trend charts.
--
-- Internal pages (dashboard, brand page, label page) read mx_trend and filter
-- client-side -- the series is small enough that one fetch covers all three.
-- Share routes get their own definer functions, same exclusion rule as every
-- other share function: no owner, no assist, no spend, no notes, no ranks.

create or replace view public.mx_trend
with (security_invoker = true) as
  select brand_id, brand_name, brand_type, labels, network, content_type,
         month, posts, median_views, median_engagement_rate, growth_multiple
  from metrics.monthly_trend;

grant select on public.mx_trend to authenticated, service_role;

-- Per-brand share route. Resolves the token internally, so the token can
-- never widen to another brand.
create or replace function public.mx_share_trend(p_token text)
returns table (
  network text, content_type text, month date, posts bigint,
  median_views numeric, median_engagement_rate numeric, growth_multiple numeric
)
language sql stable security definer set search_path = metrics, public as $$
  select t.network, t.content_type, t.month, t.posts,
         t.median_views, t.median_engagement_rate, t.growth_multiple
  from metrics.monthly_trend t
  where t.brand_id = public.mx_share_brand_id(p_token)
    and public.mx_share_brand_id(p_token) is not null
  order by t.network, t.content_type, t.month;
$$;

-- Per-label share route. One line per brand carrying that label.
create or replace function public.mx_label_share_trend(p_token text)
returns table (
  brand_name text, network text, content_type text, month date, posts bigint,
  median_views numeric, median_engagement_rate numeric, growth_multiple numeric
)
language sql stable security definer set search_path = metrics, public as $$
  select t.brand_name, t.network, t.content_type, t.month, t.posts,
         t.median_views, t.median_engagement_rate, t.growth_multiple
  from metrics.monthly_trend t
  where public.mx_label_share_name(p_token) = any(t.labels)
    and public.mx_label_share_name(p_token) is not null
  order by t.brand_name, t.network, t.content_type, t.month;
$$;

revoke execute on function public.mx_share_trend(text) from public;
revoke execute on function public.mx_label_share_trend(text) from public;
grant execute on function public.mx_share_trend(text) to anon, authenticated, service_role;
grant execute on function public.mx_label_share_trend(text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
