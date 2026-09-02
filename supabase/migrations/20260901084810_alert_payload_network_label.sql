create or replace function public.mx_alert_payload()
returns jsonb
language sql
stable security definer
set search_path to 'metrics', 'public'
as $function$
  with a as (select * from metrics.alerts),
  lead_post as (select * from a order by views_now desc limit 1),
  head as (
    select coalesce((
      select case
        when l.is_reescalation and l.growth_since_last_pct is not null
          then l.brand_name || ' - now ' || to_char(l.views_now,'FM999,999,999')
               || ' views, up ' || to_char(l.growth_since_last_pct,'FM999,999')
               || '% since we flagged it'
        else l.brand_name || ' - ' || to_char(l.views_now,'FM999,999,999')
             || ' views, ' || l.views_multiple || 'x its median'
      end
      from lead_post l), '') as h
  ),
  intro as (
    select case
      when (select count(*) from a where not is_reescalation) = 0
        then 'A post we have already flagged has kept scaling - it is up at least half again on where it was when we last emailed you.'
      else 'A post has passed 10,000 views and is running at 2.5&times; or more of what is normal for its account.'
    end as t
  ),
  rows_html as (
    select coalesce(string_agg(
      '<tr><td style="padding:18px 0;border-bottom:1px solid #e8e4dd;">'
      || '<div style="font:600 16px/1.4 Helvetica,Arial,sans-serif;color:#1a1a1a;">'
      ||   a.brand_name || '<span style="font-weight:400;color:#8a8378;"> &middot; '
      ||   public.mx_network_label(a.network) || ' ' || a.content_type
      ||   case when a.is_reescalation then ' &middot; still scaling' else '' end
      ||   '</span></div>'
      || '<div style="font:400 14px/1.5 Helvetica,Arial,sans-serif;color:#5a5449;margin-top:4px;">'
      ||   coalesce(nullif(left(a.caption,160),''), '(no caption)') || '</div>'
      || '<div style="font:400 13px/1.5 Helvetica,Arial,sans-serif;color:#8a8378;margin-top:6px;">'
      ||   '<span style="color:#a6522c;font-weight:600;">' || a.views_multiple
      ||   '&times; its median</span> &middot; '
      ||   to_char(a.views_now,'FM999,999,999') || ' views'
      ||   case
             when a.is_reescalation and a.growth_since_last_pct is not null
               then ' &middot; <span style="color:#a6522c;font-weight:600;">+'
                    || to_char(a.growth_since_last_pct,'FM999,999') || '% since '
                    || to_char(a.last_sent_on,'DD Mon') || '</span>'
             when coalesce(a.views_gained,0) > 0
               then ' (+' || to_char(a.views_gained,'FM999,999,999') || ' since yesterday)'
             else ''
           end
      ||   ' &middot; posted ' || to_char(a.published_at,'DD Mon')
      ||   case when a.permalink is not null
              then ' &middot; <a href="' || a.permalink
                   || '" style="color:#8a8378;">view post</a>' else '' end
      || '</div></td></tr>', '' order by a.views_now desc), '') as html
    from a
  ),
  recent as (
    select r.*
    from metrics.recent_breakouts r
    where not exists (
      select 1 from a
      where a.external_id  = r.external_id
        and a.network      = r.network
        and a.content_type = r.content_type)
    order by r.views_now desc
    limit 6
  ),
  recent_html as (
    select coalesce(
      '<div style="margin-top:32px;padding-top:20px;border-top:1px solid #e8e4dd;">'
      || '<div style="font:400 11px/1 Helvetica,Arial,sans-serif;letter-spacing:2px;'
      || 'text-transform:uppercase;color:#a6522c;margin-bottom:12px;">Recent breakouts</div>'
      || string_agg(
           '<div style="font:400 13px/1.6 Helvetica,Arial,sans-serif;color:#5a5449;padding:4px 0;">'
           || r.brand_name
           || '<span style="color:#8a8378;"> &middot; ' || public.mx_network_label(r.network)
           || ' ' || r.content_type || '</span> &mdash; '
           || to_char(r.views_now,'FM999,999,999') || ' views &middot; '
           || r.views_multiple || '&times;'
           || case when r.views_since_last_send > 0
                   then ' &middot; +' || to_char(r.views_since_last_send,'FM999,999,999')
                        || ' since ' || to_char(r.last_sent_on,'DD Mon')
                   else ' &middot; flat since ' || to_char(r.last_sent_on,'DD Mon') end
           || case when r.permalink is not null
                   then ' &middot; <a href="' || r.permalink
                        || '" style="color:#8a8378;">view</a>' else '' end
           || '</div>', '' order by r.views_now desc)
      || '</div>', '') as html
    from recent r
  )
  select jsonb_build_object(
    'count',            (select count(*) from a),
    'new_count',        (select count(*) from a where not is_reescalation),
    'escalation_count', (select count(*) from a where is_reescalation),
    'recipients_csv',   (select string_agg(email, ',') from metrics.alert_recipients
                         where active and alerts),
    'headline',         (select h from head),
    'html_body',
      '<div style="max-width:640px;margin:0 auto;padding:32px 24px;background:#fbfaf7;">'
      || '<div style="font:400 11px/1 Helvetica,Arial,sans-serif;letter-spacing:2px;'
      || 'text-transform:uppercase;color:#a6522c;">Breakout</div>'
      || '<h1 style="font:400 28px/1.25 Georgia,serif;color:#1a1a1a;margin:12px 0 6px;">'
      || (select h from head) || '</h1>'
      || '<div style="font:400 13px/1.5 Helvetica,Arial,sans-serif;color:#8a8378;margin-bottom:28px;">'
      || (select t from intro) || '</div>'
      || '<table style="width:100%;border-collapse:collapse;">'
      || (select html from rows_html) || '</table>'
      || (select html from recent_html)
      || '<div style="margin-top:36px;padding-top:20px;border-top:1px solid #e8e4dd;">'
      || '<a href="https://dttrmetrics.futuresoundartistservices.com" '
      || 'style="display:inline-block;padding:11px 20px;background:#1a1a1a;color:#fbfaf7;'
      || 'font:400 14px Helvetica,Arial,sans-serif;text-decoration:none;">Open the dashboard</a>'
      || '<div style="font:400 12px/1.6 Helvetica,Arial,sans-serif;color:#a09889;margin-top:16px;">'
      || 'You will only hear about a post again if it grows another 50&#37; on top of the '
      || 'views it had the last time we emailed you about it. Everything else stays in '
      || 'Recent breakouts above, and on the dashboard.</div></div></div>'
  );
$function$;

notify pgrst, 'reload schema';
