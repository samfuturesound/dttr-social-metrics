create or replace view metrics.alert_recipient_list as 
 SELECT string_agg(email, ','::text) FILTER (WHERE alerts) AS alert_emails,
    string_agg(email, ','::text) FILTER (WHERE digest) AS digest_emails
   FROM metrics.alert_recipients
  WHERE active;

create or replace view metrics.brand_label_names as 
 SELECT br.id AS brand_id,
    COALESCE(array_agg(ll.name ORDER BY ll.name) FILTER (WHERE ll.name IS NOT NULL), '{}'::text[]) AS labels
   FROM metrics.brands br
     LEFT JOIN metrics.brand_labels bl ON bl.brand_id = br.id
     LEFT JOIN metrics.labels_list ll ON ll.id = bl.label_id
  GROUP BY br.id;

create or replace view metrics.labels as 
 SELECT ll.id AS label_id,
    ll.name,
    ll.slug,
    count(bl.brand_id) AS brands,
    count(bl.brand_id) FILTER (WHERE br.active) AS active_brands,
    count(bl.brand_id) FILTER (WHERE br.brand_type = 'artist'::text) AS artist_brands,
    count(bl.brand_id) FILTER (WHERE br.brand_type = 'theme'::text) AS theme_brands
   FROM metrics.labels_list ll
     LEFT JOIN metrics.brand_labels bl ON bl.label_id = ll.id
     LEFT JOIN metrics.brands br ON br.id = bl.brand_id
  GROUP BY ll.id, ll.name, ll.slug;

create or replace view metrics.period as 
 SELECT (CURRENT_DATE - '30 days'::interval)::date AS period_start,
    CURRENT_DATE AS period_end,
    30 AS period_days;

create or replace view metrics.post_assist as 
 SELECT external_id,
    min(started_on) AS assisted_from,
    string_agg(DISTINCT kind, ', '::text) AS assist_kinds,
    sum(spend) AS total_spend
   FROM metrics.post_interventions
  GROUP BY external_id;

create or replace view metrics.snapshots as 
 SELECT id,
    brand_id,
    network,
    content_type,
    external_id,
    captured_on,
    COALESCE(((payload -> 'publishedAt'::text) ->> 'dateTime'::text)::timestamp without time zone, (((payload ->> 'createTime'::text)::timestamp with time zone) AT TIME ZONE 'UTC'::text)) AS published_at,
    COALESCE(payload ->> 'url'::text, payload ->> 'shareUrl'::text, payload ->> 'permalink'::text) AS permalink,
    COALESCE(payload ->> 'content'::text, payload ->> 'videoDescription'::text) AS caption,
    COALESCE(payload ->> 'imageUrl'::text, payload ->> 'coverImageUrl'::text, payload ->> 'thumbnailUrl'::text) AS thumbnail_url,
    COALESCE((payload ->> 'views'::text)::bigint, (payload ->> 'viewCount'::text)::bigint, (payload ->> 'impressions'::text)::bigint) AS views,
    (payload ->> 'reach'::text)::bigint AS reach,
    COALESCE((payload ->> 'likes'::text)::bigint, (payload ->> 'likeCount'::text)::bigint) AS likes,
    COALESCE((payload ->> 'comments'::text)::bigint, (payload ->> 'commentCount'::text)::bigint, (payload ->> 'replies'::text)::bigint) AS comments,
    COALESCE((payload ->> 'shares'::text)::bigint, (payload ->> 'shareCount'::text)::bigint) AS shares,
    (payload ->> 'saved'::text)::bigint AS saves,
    (payload ->> 'follows'::text)::bigint AS follows,
    (payload ->> 'engagement'::text)::numeric AS engagement_pct,
    (payload ->> 'averageWatchTime'::text)::numeric AS avg_watch_seconds,
    (payload ->> 'durationSeconds'::text)::numeric AS duration_seconds,
    (payload ->> 'reelsSkipRate'::text)::numeric AS skip_rate,
    (payload ->> 'reposts'::text)::bigint AS reposts,
    payload
   FROM metrics.raw_snapshots r;

create or replace view metrics.streaming_response as 
 SELECT id,
    track_name,
    captured_on,
    period_label,
    streams,
    listeners,
    saves,
    playlist_adds,
    src_library,
    src_external,
    src_search,
    src_queue,
    src_algorithmic,
    src_editorial,
    source,
    screenshot_url,
    raw_extract,
    triggered_by_external_id,
    created_at,
    COALESCE(src_library, 0::bigint) + COALESCE(src_external, 0::bigint) + COALESCE(src_search, 0::bigint) + COALESCE(src_queue, 0::bigint) AS active_streams,
    COALESCE(src_algorithmic, 0::bigint) + COALESCE(src_editorial, 0::bigint) AS programmed_streams,
        CASE
            WHEN streams > 0 THEN round(100.0 * (COALESCE(src_library, 0::bigint) + COALESCE(src_external, 0::bigint) + COALESCE(src_search, 0::bigint) + COALESCE(src_queue, 0::bigint))::numeric / streams::numeric, 1)
            ELSE NULL::numeric
        END AS pct_active,
        CASE
            WHEN listeners > 0 THEN round(100.0 * COALESCE(saves, 0::bigint)::numeric / listeners::numeric, 1)
            ELSE NULL::numeric
        END AS save_rate
   FROM metrics.streaming_captures sc;

create or replace view metrics.snapshots_aged as 
 SELECT id,
    brand_id,
    network,
    content_type,
    external_id,
    captured_on,
    published_at,
    permalink,
    caption,
    thumbnail_url,
    views,
    reach,
    likes,
    comments,
    shares,
    saves,
    follows,
    engagement_pct,
    avg_watch_seconds,
    duration_seconds,
    skip_rate,
    reposts,
    payload,
    GREATEST(0, captured_on - published_at::date) AS age_days,
    COALESCE(likes, 0::bigint) + COALESCE(comments, 0::bigint) + COALESCE(shares, 0::bigint) + COALESCE(saves, 0::bigint) AS engagements
   FROM metrics.snapshots s;
