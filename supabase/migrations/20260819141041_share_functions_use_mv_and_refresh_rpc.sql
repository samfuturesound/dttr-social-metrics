create or replace function public.mx_share_posts(p_token text)
 returns table(external_id text, brand_name text, network text, content_type text, caption text,
   permalink text, thumbnail_url text, published_at timestamp without time zone, age_days integer,
   views bigint, likes bigint, comments bigint, shares bigint, saves bigint,
   median_views double precision, views_multiple numeric, engagement_rate numeric,
   engagement_multiple numeric, completion_pct numeric, skip_rate numeric)
 language sql stable security definer
 set search_path to 'metrics', 'public'
as $function$
  select pd.external_id, pd.brand_name, pd.network, pd.content_type,
         pd.caption, pd.permalink, pd.thumbnail_url,
         pd.published_at, pd.age_days,
         pd.views, pd.likes, pd.comments, pd.shares, pd.saves,
         pd.median_views, pd.views_multiple,
         pd.engagement_rate, pd.engagement_multiple,
         pd.completion_pct, pd.skip_rate
  from metrics.post_detail_mv pd
  where pd.brand_id = public.mx_share_brand_id(p_token);
$function$;

create or replace function public.mx_label_share_posts(p_token text)
 returns table(external_id text, brand_name text, network text, content_type text, caption text,
   permalink text, thumbnail_url text, published_at timestamp without time zone, age_days integer,
   views bigint, likes bigint, comments bigint, shares bigint, saves bigint,
   median_views double precision, views_multiple numeric, engagement_rate numeric,
   engagement_multiple numeric, completion_pct numeric, skip_rate numeric)
 language sql stable security definer
 set search_path to 'metrics', 'public'
as $function$
  select pd.external_id, pd.brand_name, pd.network, pd.content_type,
         pd.caption, pd.permalink, pd.thumbnail_url,
         pd.published_at, pd.age_days,
         pd.views, pd.likes, pd.comments, pd.shares, pd.saves,
         pd.median_views, pd.views_multiple,
         pd.engagement_rate, pd.engagement_multiple,
         pd.completion_pct, pd.skip_rate
  from metrics.post_detail_mv pd
  where public.mx_label_share_name(p_token) is not null
    and public.mx_label_share_name(p_token) = any (pd.labels);
$function$;

create or replace function public.mx_refresh_derived()
 returns text
 language plpgsql security definer
 set search_path to 'metrics', 'public'
as $function$
begin
  refresh materialized view concurrently metrics.post_detail_mv;
  analyze metrics.post_detail_mv;
  return 'post_detail_mv refreshed at ' || now()::text;
end $function$;

revoke execute on function public.mx_refresh_derived() from public, anon, authenticated;
grant execute on function public.mx_refresh_derived() to service_role;

notify pgrst, 'reload schema';
