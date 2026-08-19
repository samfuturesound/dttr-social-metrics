create or replace view public.mx_account_scores as
 SELECT brand_name, brand_type, owner, labels, posts, total_score, avg_multiple, total_views, best_multiple
   FROM metrics.account_scores;

create or replace view public.mx_ai_queries as
 SELECT id, asked_at, question, brand_filter, error
   FROM metrics.ai_queries;

create or replace view public.mx_alert_recipient_list as
 SELECT alert_emails, digest_emails
   FROM metrics.alert_recipient_list;

create or replace view public.mx_alert_recipients as
 SELECT id, email, name, alerts, digest, active, created_at
   FROM metrics.alert_recipients;

create or replace view public.mx_alerts as
 SELECT external_id, brand_name, brand_type, labels, network, content_type, caption, permalink,
    thumbnail_url, published_at, age_days, captured_now, captured_prev, views_prev, views_now,
    views_gained, views_pct_change, views_multiple, median_views, multiple_prev, reason
   FROM metrics.alerts;

create or replace view public.mx_best as
 SELECT external_id, brand_name, brand_type, owner, labels, network, content_type, caption,
    permalink, thumbnail_url, published_at, age_days, views, likes, comments, shares, saves,
    engagement_pct, skip_rate, avg_watch_seconds, median_views, views_multiple, sample_size,
    assisted_from, assist_kinds, is_assisted
   FROM metrics.best_posts;

create or replace view public.mx_brand_platform_ranks as
 SELECT brand_id, brand_name, brand_type, labels, network, content_type, posts, views, median_views,
    median_engagement_rate, median_completion_pct, completion_available, last_post,
    rank_views_all, total_views_all, rank_views_type, total_views_type,
    rank_eng_all, total_eng_all, rank_eng_type, total_eng_type,
    rank_completion_all, total_completion_all, rank_completion_type, total_completion_type
   FROM metrics.brand_platform_ranks;

create or replace view public.mx_brand_platform_summary as
 SELECT brand_id, brand_name, brand_type, labels, network, content_type, posts, views,
    median_views, median_engagement_rate, median_completion_pct, completion_available, last_post
   FROM metrics.brand_platform_summary;

create or replace view public.mx_brand_skip_rates as
 SELECT brand_name, network, content_type, reels_counted, median_skip_rate
   FROM metrics.brand_skip_rates;

create or replace view public.mx_brand_summary as
 SELECT brand_id, brand_name, brand_type, owner, niche, active, metricool_blog_id, labels,
    posts_all_time, views_all_time, posts_3m, views_3m, median_views, median_engagement_rate,
    median_completion_pct, first_post, last_post
   FROM metrics.brand_summary;

create or replace view public.mx_brands as
 SELECT br.id, br.metricool_blog_id, br.name, br.brand_type, br.niche, br.owner, br.active, bln.labels
   FROM metrics.brands br
     JOIN metrics.brand_label_names bln ON bln.brand_id = br.id;

create or replace view public.mx_digest as
 SELECT posts_14d, views_14d, live_alerts, above_baseline_14d, last_pull
   FROM metrics.digest;

create or replace view public.mx_digest_leading as
 SELECT brand_name, brand_type, network, content_type, published, views, views_multiple,
    median_views, permalink, skip_rate, caption
   FROM metrics.digest_leading;

create or replace view public.mx_flagged as
 SELECT external_id, brand_name, brand_type, owner, network, content_type, caption, permalink,
    thumbnail_url, published_at, age_days, views, median_views, views_multiple, engagements,
    engagement_pct, skip_rate, avg_watch_seconds, sample_size, assisted_from, assist_kinds, is_assisted
   FROM metrics.flagged_posts;

create or replace view public.mx_flagged_interim as
 SELECT external_id, brand_name, brand_type, owner, network, content_type, caption, permalink,
    thumbnail_url, published_at, age_days, views, median_views, views_multiple, engagement_pct,
    skip_rate, avg_watch_seconds, sample_size, assisted_from, assist_kinds, is_assisted
   FROM metrics.flagged_posts_interim;

create or replace view public.mx_interventions as
 SELECT id, external_id, kind, started_on, ended_on, spend, currency, notes, created_by, created_at
   FROM metrics.post_interventions;

create or replace view public.mx_labels as
 SELECT label_id, name, slug, brands, active_brands, artist_brands, theme_brands
   FROM metrics.labels;

create or replace view public.mx_leaderboard as
 SELECT month, owner, growth_multiple
   FROM metrics.monthly_by_owner_relative;

create or replace view public.mx_leading as
 SELECT external_id, brand_name, brand_type, owner, labels, network, content_type, caption,
    permalink, thumbnail_url, published_at, age_days, views, likes, comments, shares, saves,
    engagement_pct, skip_rate, avg_watch_seconds, median_views, views_multiple, sample_size,
    assisted_from, assist_kinds, is_assisted
   FROM metrics.leading_posts;

create or replace view public.mx_movers as
 SELECT external_id, brand_name, brand_type, labels, network, content_type, caption, permalink,
    thumbnail_url, published_at, age_days, captured_now, captured_prev, views_now, views_prev,
    views_gained, views_pct_change
   FROM metrics.movers;

create or replace view public.mx_notes as
 SELECT id, external_id, note, author, created_at
   FROM metrics.post_notes;

create or replace view public.mx_period as
 SELECT period_start, period_end, period_days
   FROM metrics.period;

create or replace view public.mx_post_detail as
 SELECT external_id, brand_name, brand_type, owner, labels, network, content_type, caption,
    permalink, thumbnail_url, published_at, age_days, views, likes, comments, shares, saves,
    engagement_pct, skip_rate, avg_watch_seconds, median_views, views_multiple, sample_size,
    assisted_from, assist_kinds, is_assisted, follows, reach, duration_seconds, weighted_engagement,
    engagement_rate, completion_pct, median_engagement_rate, median_completion_pct, engagement_multiple
   FROM metrics.post_detail;

create or replace view public.mx_recent as
 SELECT external_id, brand_name, brand_type, owner, labels, network, content_type, caption,
    permalink, thumbnail_url, published_at, age_days, views, likes, comments, shares, saves,
    engagement_pct, skip_rate, avg_watch_seconds, median_views, views_multiple, sample_size,
    assisted_from, assist_kinds, is_assisted, rn
   FROM metrics.recent_posts;

create or replace view public.mx_skip_roster as
 SELECT reels_counted, roster_median, best_skip_rate, worst_skip_rate
   FROM metrics.skip_roster;

create or replace view public.mx_snapshots as
 SELECT id, brand_id, network, content_type, external_id, captured_on, published_at, permalink,
    caption, thumbnail_url, views, reach, likes, comments, shares, saves, follows, engagement_pct,
    avg_watch_seconds, duration_seconds, skip_rate, reposts, age_days, engagements
   FROM metrics.snapshots_aged;

create or replace view public.mx_streaming as
 SELECT id, track_name, captured_on, period_label, streams, listeners, saves, playlist_adds,
    src_library, src_external, src_search, src_queue, src_algorithmic, src_editorial, source,
    screenshot_url, raw_extract, triggered_by_external_id, created_at, active_streams,
    programmed_streams, pct_active, save_rate
   FROM metrics.streaming_response;

create or replace view public.mx_top_views as
 SELECT external_id, brand_name, brand_type, owner, labels, network, content_type, caption,
    permalink, thumbnail_url, published_at, age_days, views, likes, comments, shares, saves,
    engagement_pct, skip_rate, avg_watch_seconds, median_views, views_multiple, sample_size,
    assisted_from, assist_kinds, is_assisted
   FROM metrics.top_by_views;

revoke execute on all functions in schema public from public, anon, authenticated;
grant select on all tables in schema public to authenticated;

grant execute on function public.mx_is_internal() to anon, authenticated;
grant execute on function public.mx_assert_internal() to anon, authenticated;

grant execute on function public.mx_add_brand(text,text,text,text,text) to authenticated;
grant execute on function public.mx_set_brand_active(bigint,boolean) to authenticated;
grant execute on function public.mx_add_label(text) to authenticated;
grant execute on function public.mx_set_brand_label(bigint,text,boolean) to authenticated;
grant execute on function public.mx_add_note(text,text,text) to authenticated;
grant execute on function public.mx_add_intervention(text,text,date,date,numeric,text,text) to authenticated;
grant execute on function public.mx_remove_intervention(bigint) to authenticated;
grant execute on function public.mx_add_streaming_capture(jsonb) to authenticated;
grant execute on function public.mx_set_recipient(text,text,boolean,boolean,boolean) to authenticated;
grant execute on function public.mx_create_share(bigint,text,date) to authenticated;
grant execute on function public.mx_revoke_share(bigint) to authenticated;
grant execute on function public.mx_list_shares() to authenticated;
grant execute on function public.mx_create_label_share(text,text,date) to authenticated;
grant execute on function public.mx_revoke_label_share(bigint) to authenticated;
grant execute on function public.mx_list_label_shares() to authenticated;
grant execute on function public.mx_alert_payload() to authenticated;
grant execute on function public.mx_digest_payload() to authenticated;

grant execute on function public.mx_share_brand_id(text) to anon, authenticated;
grant execute on function public.mx_share_summary(text) to anon, authenticated;
grant execute on function public.mx_share_posts(text) to anon, authenticated;
grant execute on function public.mx_label_share_name(text) to anon, authenticated;
grant execute on function public.mx_label_share_summary(text) to anon, authenticated;
grant execute on function public.mx_label_share_posts(text) to anon, authenticated;

notify pgrst, 'reload schema';
