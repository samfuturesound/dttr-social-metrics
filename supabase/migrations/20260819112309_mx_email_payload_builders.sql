CREATE OR REPLACE FUNCTION public.mx_alert_payload()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'metrics', 'public'
AS $function$
  with a as (select * from metrics.alerts),
  head as (
    select coalesce((select a.brand_name || ' - ' || to_char(a.views_now,'FM999,999,999')
                     || ' views, ' || a.views_multiple || 'x its median'
                     from a order by a.views_now desc limit 1), '') as h
  ),
  rows_html as (
    select coalesce(string_agg(
      '<tr><td style="padding:18px 0;border-bottom:1px solid #e8e4dd;">'
      || '<div style="font:600 16px/1.4 Helvetica,Arial,sans-serif;color:#1a1a1a;">'
      ||   a.brand_name || '<span style="font-weight:400;color:#8a8378;"> &middot; '
      ||   initcap(a.network) || ' ' || a.content_type || '</span></div>'
      || '<div style="font:400 14px/1.5 Helvetica,Arial,sans-serif;color:#5a5449;margin-top:4px;">'
      ||   coalesce(nullif(left(a.caption,160),''), '(no caption)') || '</div>'
      || '<div style="font:400 13px/1.5 Helvetica,Arial,sans-serif;color:#8a8378;margin-top:6px;">'
      ||   '<span style="color:#a6522c;font-weight:600;">' || a.views_multiple
      ||   '&times; its median</span> &middot; '
      ||   to_char(a.views_now,'FM999,999,999') || ' views'
      ||   case when a.views_gained > 0
              then ' (+' || to_char(a.views_gained,'FM999,999,999') || ' since yesterday)'
              else '' end
      ||   ' &middot; posted ' || to_char(a.published_at,'DD Mon')
      ||   case when a.permalink is not null
              then ' &middot; <a href="' || a.permalink
                   || '" style="color:#8a8378;">view post</a>' else '' end
      || '</div></td></tr>', '' order by a.views_now desc), '') as html
    from a
  )
  select jsonb_build_object(
    'count',          (select count(*) from a),
    'recipients_csv', (select string_agg(email, ',') from metrics.alert_recipients
                       where active and alerts),
    'headline',       (select h from head),
    'html_body',
      '<div style="max-width:640px;margin:0 auto;padding:32px 24px;background:#fbfaf7;">'
      || '<div style="font:400 11px/1 Helvetica,Arial,sans-serif;letter-spacing:2px;'
      || 'text-transform:uppercase;color:#a6522c;">Breakout</div>'
      || '<h1 style="font:400 28px/1.25 Georgia,serif;color:#1a1a1a;margin:12px 0 6px;">'
      || (select h from head) || '</h1>'
      || '<div style="font:400 13px/1.5 Helvetica,Arial,sans-serif;color:#8a8378;margin-bottom:28px;">'
      || 'A post has passed 10,000 views and is running at 2.5&times; or more of what is '
      || 'normal for its account.</div>'
      || '<table style="width:100%;border-collapse:collapse;">'
      || (select html from rows_html) || '</table>'
      || '<div style="margin-top:36px;padding-top:20px;border-top:1px solid #e8e4dd;">'
      || '<a href="https://dttrmetrics.futuresoundartistservices.com" '
      || 'style="display:inline-block;padding:11px 20px;background:#1a1a1a;color:#fbfaf7;'
      || 'font:400 14px Helvetica,Arial,sans-serif;text-decoration:none;">Open the dashboard</a>'
      || '<div style="font:400 12px/1.6 Helvetica,Arial,sans-serif;color:#a09889;margin-top:16px;">'
      || 'This fires once, when a post first crosses both marks. You will not be emailed about '
      || 'it again while it stays there &mdash; the dashboard tracks it from here.</div></div></div>'
  );
$function$;

CREATE OR REPLACE FUNCTION public.mx_digest_payload()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'metrics', 'public'
AS $function$
  with recent as (
    select * from metrics.scored_posts
    where published_at >= now() - interval '14 days'
  ),
  totals as (
    select count(*) as posts_14d,
           coalesce(sum(views),0) as views_14d,
           count(*) filter (where views_multiple >= 2.5) as above_baseline_14d
    from recent
  ),
  lead as (
    select * from recent
    where sample_size >= 10 and median_views > 0
    order by views_multiple desc nulls last
    limit 8
  ),
  rows_html as (
    select string_agg(
      '<tr><td style="padding:18px 0;border-bottom:1px solid #e8e4dd;">'
      || '<div style="font:600 15px/1.4 Helvetica,Arial,sans-serif;color:#1a1a1a;">'
      ||   l.brand_name || '<span style="font-weight:400;color:#8a8378;"> &middot; '
      ||   initcap(l.network) || ' ' || l.content_type || '</span></div>'
      || '<div style="font:400 14px/1.5 Helvetica,Arial,sans-serif;color:#5a5449;margin-top:4px;">'
      ||   coalesce(nullif(left(l.caption,160),''), '(no caption)') || '</div>'
      || '<div style="font:400 13px/1.5 Helvetica,Arial,sans-serif;color:#8a8378;margin-top:6px;">'
      ||   '<span style="color:#a6522c;font-weight:600;">' || l.views_multiple || '&times;</span>'
      ||   ' &middot; ' || to_char(l.views,'FM999,999,999') || ' views vs '
      ||   to_char(l.median_views::bigint,'FM999,999,999') || ' median &middot; '
      ||   to_char(l.published_at,'DD Mon')
      ||   case when l.permalink is not null
              then ' &middot; <a href="' || l.permalink
                   || '" style="color:#8a8378;">view post</a>' else '' end
      || '</div></td></tr>', '' order by l.views_multiple desc) as html
    from lead l
  ),
  prompt as (
    select 'Leading posts of the last fortnight. ' || string_agg(
        l.brand_name || ' on ' || l.network || ' ' || l.content_type
        || ', posted ' || to_char(l.published_at,'DD Mon') || ': '
        || to_char(l.views,'FM999,999,999') || ' views against a median of '
        || to_char(l.median_views::bigint,'FM999,999,999') || ', a multiple of '
        || l.views_multiple || '. '
        || case when l.skip_rate is not null
                then 'Skip rate ' || l.skip_rate || ' percent. ' else '' end
        || 'Caption: ' || replace(coalesce(nullif(left(l.caption,200),''),'none'), '"', '')
        , ' | ' order by l.views_multiple desc) as txt
    from lead l
  )
  select jsonb_build_object(
    'post_count',     (select count(*) from lead),
    'recipients_csv', (select string_agg(email, ',') from metrics.alert_recipients
                       where active and digest),
    'ai_prompt', coalesce((select txt from prompt), 'No posts in the period.')
                 || ' Across the whole period there were '
                 || (select posts_14d from totals) || ' posts, '
                 || to_char((select views_14d from totals),'FM999,999,999')
                 || ' total views, and '
                 || (select above_baseline_14d from totals) || ' posts above baseline.',
    'html_before',
      '<div style="max-width:640px;margin:0 auto;padding:32px 24px;background:#fbfaf7;">'
      || '<div style="font:400 11px/1 Helvetica,Arial,sans-serif;letter-spacing:2px;'
      || 'text-transform:uppercase;color:#8a8378;">Futuresound Group</div>'
      || '<h1 style="font:400 30px/1.2 Georgia,serif;color:#1a1a1a;margin:12px 0 4px;">'
      || 'Fortnightly social digest</h1>'
      || '<div style="font:400 13px/1.5 Helvetica,Arial,sans-serif;color:#8a8378;margin-bottom:28px;">'
      || to_char(current_date - 14,'DD Mon') || ' &ndash; ' || to_char(current_date,'DD Mon YYYY')
      || ' &middot; ' || (select posts_14d from totals) || ' posts &middot; '
      || to_char((select views_14d from totals),'FM999,999,999') || ' views</div>'
      || '<div style="font:400 15px/1.65 Helvetica,Arial,sans-serif;color:#3a352d;'
      || 'margin-bottom:32px;white-space:pre-line;">',
    'html_after',
      '</div><div style="font:400 11px/1 Helvetica,Arial,sans-serif;letter-spacing:2px;'
      || 'text-transform:uppercase;color:#8a8378;margin-bottom:4px;">Leading posts</div>'
      || '<table style="width:100%;border-collapse:collapse;">'
      || coalesce((select html from rows_html),'') || '</table>'
      || '<div style="margin-top:36px;padding-top:20px;border-top:1px solid #e8e4dd;">'
      || '<a href="https://dttrmetrics.futuresoundartistservices.com" '
      || 'style="display:inline-block;padding:11px 20px;background:#1a1a1a;color:#fbfaf7;'
      || 'font:400 14px Helvetica,Arial,sans-serif;text-decoration:none;">Open the dashboard</a>'
      || '<div style="font:400 12px/1.6 Helvetica,Arial,sans-serif;color:#a09889;margin-top:16px;">'
      || 'The multiple compares a post with what is normal for its own account, on that platform, '
      || 'in that format. It measures unusualness, not quality. Full detail, per-brand pages and '
      || 'the AI query tool are on the dashboard.</div></div></div>'
  );
$function$;
