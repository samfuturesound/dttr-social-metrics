CREATE OR REPLACE FUNCTION public.mx_is_internal()
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select coalesce(
    (auth.jwt() ->> 'email') = 'mx-internal@dttrsocialmetrics.app',
    false
  )
$function$;

CREATE OR REPLACE FUNCTION public.mx_assert_internal()
 RETURNS void
 LANGUAGE plpgsql
 STABLE
AS $function$
begin
  if public.mx_is_internal() then return; end if;
  if coalesce(auth.jwt() ->> 'role', '') = 'service_role' then return; end if;
  if session_user in ('postgres', 'supabase_admin') then return; end if;
  raise exception 'mx: not authorized';
end $function$;

CREATE OR REPLACE FUNCTION public.mx_ingest(p_brand_id bigint, p_network text, p_content_type text, p_captured_on date, p_body jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'metrics', 'public'
AS $function$
declare
  n integer;
begin
  insert into metrics.raw_snapshots
    (brand_id, network, content_type, external_id, captured_on, payload)
  select p_brand_id, p_network, p_content_type,
         coalesce(e->>'postId', e->>'reelId', e->>'videoId', e->>'id'),
         p_captured_on, e
  from jsonb_array_elements(coalesce(p_body->'data', '[]'::jsonb)) as e
  where coalesce(e->>'postId', e->>'reelId', e->>'videoId', e->>'id') is not null
  on conflict (brand_id, network, content_type, external_id, captured_on)
  do update set payload = excluded.payload;
  get diagnostics n = row_count;
  return n;
end;
$function$;

CREATE OR REPLACE FUNCTION public.mx_upsert_snapshot(p_brand_id bigint, p_network text, p_content_type text, p_external_id text, p_captured_on date, p_payload jsonb)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'metrics', 'public'
AS $function$
  insert into metrics.raw_snapshots
    (brand_id, network, content_type, external_id, captured_on, payload)
  values (p_brand_id, p_network, p_content_type, p_external_id,
          p_captured_on, p_payload)
  on conflict (brand_id, network, content_type, external_id, captured_on)
  do update set payload = excluded.payload;
$function$;

CREATE OR REPLACE FUNCTION public.mx_debug(p_note text, p_payload jsonb)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'metrics', 'public'
AS $function$
  insert into metrics.debug_log (note, payload) values (p_note, p_payload);
$function$;

CREATE OR REPLACE FUNCTION public.mx_add_brand(p_metricool_blog_id text, p_name text, p_brand_type text, p_owner text DEFAULT NULL::text, p_niche text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'metrics', 'public'
AS $function$
declare new_id bigint;
begin
  perform public.mx_assert_internal();
  insert into metrics.brands (metricool_blog_id, name, brand_type, owner, niche)
  values (p_metricool_blog_id, p_name, p_brand_type, p_owner, p_niche)
  on conflict (metricool_blog_id) do update
    set name = excluded.name, brand_type = excluded.brand_type,
        owner = coalesce(excluded.owner, metrics.brands.owner),
        niche = coalesce(excluded.niche, metrics.brands.niche),
        active = true
  returning id into new_id;
  return new_id;
end; $function$;

CREATE OR REPLACE FUNCTION public.mx_set_brand_active(p_brand_id bigint, p_active boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'metrics', 'public'
AS $function$
begin
  perform public.mx_assert_internal();
  update metrics.brands set active = p_active where id = p_brand_id;
end; $function$;

CREATE OR REPLACE FUNCTION public.mx_add_label(p_name text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'metrics', 'public'
AS $function$
declare nid bigint;
begin
  perform public.mx_assert_internal();
  insert into metrics.labels_list (name, slug)
  values (trim(p_name), lower(regexp_replace(trim(p_name),'[^a-zA-Z0-9]+','-','g')))
  on conflict (name) do update set name = excluded.name
  returning id into nid;
  return nid;
end; $function$;

CREATE OR REPLACE FUNCTION public.mx_set_brand_label(p_brand_id bigint, p_label_name text, p_on boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'metrics', 'public'
AS $function$
declare lid bigint;
begin
  perform public.mx_assert_internal();
  select id into lid from metrics.labels_list where name = p_label_name;
  if lid is null then raise exception 'unknown label: %', p_label_name; end if;
  if p_on then
    insert into metrics.brand_labels (brand_id, label_id) values (p_brand_id, lid)
    on conflict do nothing;
  else
    delete from metrics.brand_labels where brand_id = p_brand_id and label_id = lid;
  end if;
end; $function$;

CREATE OR REPLACE FUNCTION public.mx_add_note(p_external_id text, p_note text, p_author text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'metrics', 'public'
AS $function$
declare new_id bigint;
begin
  perform public.mx_assert_internal();
  insert into metrics.post_notes (external_id, note, author)
  values (p_external_id, p_note, p_author) returning id into new_id;
  return new_id;
end; $function$;

CREATE OR REPLACE FUNCTION public.mx_add_intervention(p_external_id text, p_kind text, p_started_on date, p_ended_on date DEFAULT NULL::date, p_spend numeric DEFAULT NULL::numeric, p_notes text DEFAULT NULL::text, p_created_by text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'metrics', 'public'
AS $function$
declare new_id bigint;
begin
  perform public.mx_assert_internal();
  insert into metrics.post_interventions
    (external_id, kind, started_on, ended_on, spend, notes, created_by)
  values (p_external_id, p_kind, p_started_on, p_ended_on, p_spend, p_notes, p_created_by)
  returning id into new_id;
  return new_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.mx_remove_intervention(p_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'metrics', 'public'
AS $function$
begin
  perform public.mx_assert_internal();
  delete from metrics.post_interventions where id = p_id;
end; $function$;

CREATE OR REPLACE FUNCTION public.mx_add_streaming_capture(p_payload jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'metrics', 'public'
AS $function$
declare new_id bigint;
begin
  perform public.mx_assert_internal();
  insert into metrics.streaming_captures (
    track_name, captured_on, period_label, streams, listeners, saves,
    playlist_adds, src_library, src_external, src_search, src_queue,
    src_algorithmic, src_editorial, screenshot_url, raw_extract,
    triggered_by_external_id)
  values (
    p_payload->>'track_name',
    coalesce((p_payload->>'captured_on')::date, current_date),
    coalesce(p_payload->>'period_label','28d'),
    (p_payload->>'streams')::bigint,        (p_payload->>'listeners')::bigint,
    (p_payload->>'saves')::bigint,          (p_payload->>'playlist_adds')::bigint,
    (p_payload->>'src_library')::bigint,    (p_payload->>'src_external')::bigint,
    (p_payload->>'src_search')::bigint,     (p_payload->>'src_queue')::bigint,
    (p_payload->>'src_algorithmic')::bigint,(p_payload->>'src_editorial')::bigint,
    p_payload->>'screenshot_url', p_payload,
    p_payload->>'triggered_by_external_id')
  returning id into new_id;
  return new_id;
end; $function$;

CREATE OR REPLACE FUNCTION public.mx_set_recipient(p_email text, p_name text DEFAULT NULL::text, p_alerts boolean DEFAULT true, p_digest boolean DEFAULT true, p_active boolean DEFAULT true)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'metrics', 'public'
AS $function$
declare nid bigint;
begin
  perform public.mx_assert_internal();
  insert into metrics.alert_recipients (email, name, alerts, digest, active)
  values (lower(trim(p_email)), p_name, p_alerts, p_digest, p_active)
  on conflict (email) do update
    set name = coalesce(excluded.name, metrics.alert_recipients.name),
        alerts = excluded.alerts, digest = excluded.digest, active = excluded.active
  returning id into nid;
  return nid;
end; $function$;

CREATE OR REPLACE FUNCTION public.mx_create_share(p_brand_id bigint, p_label text DEFAULT NULL::text, p_expires_on date DEFAULT NULL::date)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'metrics', 'public'
AS $function$
declare t text;
begin
  perform public.mx_assert_internal();
  insert into metrics.brand_shares (brand_id, label, expires_on)
  values (p_brand_id, p_label, p_expires_on)
  returning token into t;
  return t;
end; $function$;

CREATE OR REPLACE FUNCTION public.mx_revoke_share(p_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'metrics', 'public'
AS $function$
begin
  perform public.mx_assert_internal();
  update metrics.brand_shares set revoked = true where id = p_id;
end; $function$;

CREATE OR REPLACE FUNCTION public.mx_list_shares()
 RETURNS TABLE(id bigint, brand_id bigint, brand_name text, token text, label text, created_at timestamp with time zone, expires_on date, revoked boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'metrics', 'public'
AS $function$
begin
  perform public.mx_assert_internal();
  return query
    select s.id, s.brand_id, br.name, s.token, s.label,
           s.created_at, s.expires_on, s.revoked
    from metrics.brand_shares s
    join metrics.brands br on br.id = s.brand_id
    order by br.name, s.created_at desc;
end; $function$;

CREATE OR REPLACE FUNCTION public.mx_share_brand_id(p_token text)
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'metrics', 'public'
AS $function$
  select brand_id from metrics.brand_shares
  where token = p_token
    and revoked = false
    and (expires_on is null or expires_on >= current_date)
  limit 1;
$function$;

CREATE OR REPLACE FUNCTION public.mx_share_summary(p_token text)
 RETURNS TABLE(brand_name text, network text, content_type text, posts bigint, views numeric, median_views numeric, median_engagement_rate numeric, median_completion_pct numeric, last_post date)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'metrics', 'public'
AS $function$
  select s.brand_name, s.network, s.content_type, s.posts, s.views::numeric,
         s.median_views, s.median_engagement_rate, s.median_completion_pct,
         s.last_post
  from metrics.brand_platform_summary s
  where s.brand_id = public.mx_share_brand_id(p_token);
$function$;

CREATE OR REPLACE FUNCTION public.mx_share_posts(p_token text)
 RETURNS TABLE(external_id text, brand_name text, network text, content_type text, caption text, permalink text, thumbnail_url text, published_at timestamp without time zone, age_days integer, views bigint, likes bigint, comments bigint, shares bigint, saves bigint, median_views double precision, views_multiple numeric, engagement_rate numeric, engagement_multiple numeric, completion_pct numeric, skip_rate numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'metrics', 'public'
AS $function$
declare v_name text;
begin
  select br.name into v_name
  from metrics.brands br
  where br.id = public.mx_share_brand_id(p_token);

  if v_name is null then
    return;  -- unknown, revoked or expired token: zero rows
  end if;

  return query
    select pd.external_id, pd.brand_name, pd.network, pd.content_type,
           pd.caption, pd.permalink, pd.thumbnail_url,
           pd.published_at, pd.age_days,
           pd.views, pd.likes, pd.comments, pd.shares, pd.saves,
           pd.median_views, pd.views_multiple,
           pd.engagement_rate, pd.engagement_multiple,
           pd.completion_pct, pd.skip_rate
    from metrics.post_detail pd
    where pd.brand_name = v_name;
end;
$function$;

CREATE OR REPLACE FUNCTION public.mx_create_label_share(p_label text, p_note text DEFAULT NULL::text, p_expires_on date DEFAULT NULL::date)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'metrics', 'public'
AS $function$
declare t text;
begin
  perform public.mx_assert_internal();
  insert into metrics.label_shares (label, note, expires_on)
  values (p_label, p_note, p_expires_on) returning token into t;
  return t;
end; $function$;

CREATE OR REPLACE FUNCTION public.mx_revoke_label_share(p_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'metrics', 'public'
AS $function$
begin
  perform public.mx_assert_internal();
  update metrics.label_shares set revoked = true where id = p_id;
end; $function$;

CREATE OR REPLACE FUNCTION public.mx_list_label_shares()
 RETURNS TABLE(id bigint, label text, token text, note text, created_at timestamp with time zone, expires_on date, revoked boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'metrics', 'public'
AS $function$
begin
  perform public.mx_assert_internal();
  return query select s.id, s.label, s.token, s.note, s.created_at,
                      s.expires_on, s.revoked
               from metrics.label_shares s order by s.label, s.created_at desc;
end; $function$;

CREATE OR REPLACE FUNCTION public.mx_label_share_name(p_token text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'metrics', 'public'
AS $function$
  select label from metrics.label_shares
  where token = p_token and revoked = false
    and (expires_on is null or expires_on >= current_date)
  limit 1;
$function$;

CREATE OR REPLACE FUNCTION public.mx_label_share_summary(p_token text)
 RETURNS TABLE(brand_name text, network text, content_type text, posts bigint, views numeric, median_views numeric, median_engagement_rate numeric, median_completion_pct numeric, last_post date)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'metrics', 'public'
AS $function$
  select s.brand_name, s.network, s.content_type, s.posts, s.views::numeric,
         s.median_views, s.median_engagement_rate, s.median_completion_pct, s.last_post
  from metrics.brand_platform_summary s
  where public.mx_label_share_name(p_token) is not null
    and public.mx_label_share_name(p_token) = any (s.labels);
$function$;

CREATE OR REPLACE FUNCTION public.mx_label_share_posts(p_token text)
 RETURNS TABLE(external_id text, brand_name text, network text, content_type text, caption text, permalink text, thumbnail_url text, published_at timestamp without time zone, age_days integer, views bigint, likes bigint, comments bigint, shares bigint, saves bigint, median_views double precision, views_multiple numeric, engagement_rate numeric, engagement_multiple numeric, completion_pct numeric, skip_rate numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'metrics', 'public'
AS $function$
  select pd.external_id, pd.brand_name, pd.network, pd.content_type,
         pd.caption, pd.permalink, pd.thumbnail_url,
         pd.published_at, pd.age_days,
         pd.views, pd.likes, pd.comments, pd.shares, pd.saves,
         pd.median_views, pd.views_multiple,
         pd.engagement_rate, pd.engagement_multiple,
         pd.completion_pct, pd.skip_rate
  from metrics.post_detail pd
  where public.mx_label_share_name(p_token) is not null
    and public.mx_label_share_name(p_token) = any (pd.labels);
$function$;

CREATE OR REPLACE FUNCTION public.mx_ai_context(p_brand text DEFAULT NULL::text, p_days integer DEFAULT 365)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'metrics', 'public'
AS $function$
  select jsonb_build_object(
    'generated_at', now(),
    'filter', jsonb_build_object('brand', p_brand, 'days', p_days),
    'brands', (
      select jsonb_agg(jsonb_build_object(
        'brand', s.brand_name, 'type', s.brand_type, 'labels', s.labels,
        'network', s.network, 'format', s.content_type,
        'posts', s.posts, 'median_views', s.median_views,
        'median_engagement', s.median_engagement_rate,
        'median_completion', s.median_completion_pct))
      from metrics.brand_platform_summary s
      where p_brand is null or s.brand_name = p_brand),
    'posts', (
      select jsonb_agg(jsonb_build_object(
        'brand', pd.brand_name, 'network', pd.network, 'format', pd.content_type,
        'published', pd.published_at::date, 'age_days', pd.age_days,
        'views', pd.views, 'multiple', pd.views_multiple,
        'likes', pd.likes, 'comments', pd.comments, 'shares', pd.shares,
        'saves', pd.saves, 'engagement', pd.engagement_rate,
        'engagement_multiple', pd.engagement_multiple,
        'skip_rate', pd.skip_rate, 'completion', pd.completion_pct,
        'caption', left(coalesce(pd.caption,''), 280)))
      from metrics.post_detail pd
      where (p_brand is null or pd.brand_name = p_brand)
        and pd.published_at >= now() - make_interval(days => p_days))
  );
$function$;

CREATE OR REPLACE FUNCTION public.mx_log_ai_query(p_question text, p_brand text, p_answer text, p_tokens_in integer DEFAULT NULL::integer, p_tokens_out integer DEFAULT NULL::integer, p_error text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'metrics', 'public'
AS $function$
declare nid bigint;
begin
  insert into metrics.ai_queries (question, brand_filter, answer, tokens_in, tokens_out, error)
  values (p_question, p_brand, p_answer, p_tokens_in, p_tokens_out, p_error)
  returning id into nid;
  return nid;
end; $function$;

CREATE OR REPLACE FUNCTION public.mx_secure_metrics_views()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v record;
  n_views int := 0;
  n_tables int := 0;
begin
  for v in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'metrics' and c.relkind = 'v'
  loop
    execute format('alter view metrics.%I set (security_invoker = true)', v.relname);
    execute format('grant select on metrics.%I to authenticated', v.relname);
    n_views := n_views + 1;
  end loop;

  for v in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'metrics' and c.relkind = 'r'
      and c.relname not in ('brand_shares', 'label_shares', 'debug_log')
  loop
    execute format('alter table metrics.%I enable row level security', v.relname);
    execute format('grant select on metrics.%I to authenticated', v.relname);
    execute format('drop policy if exists mx_internal_read on metrics.%I', v.relname);
    execute format(
      'create policy mx_internal_read on metrics.%I for select to authenticated using (public.mx_is_internal())',
      v.relname);
    n_tables := n_tables + 1;
  end loop;

  notify pgrst, 'reload schema';
  return format('secured %s views, %s tables; schema cache reloaded', n_views, n_tables);
end $function$;
