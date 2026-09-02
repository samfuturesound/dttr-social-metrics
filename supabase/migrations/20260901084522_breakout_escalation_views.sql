-- Split "what is currently breaking out" from "what we should email about now".
--
-- breakout_candidates = every post over both marks, regardless of send history.
-- alerts              = candidates that are new, or have grown 1.5x since the
--                       last time we emailed about them.
-- recent_breakouts    = send history + current state, for the email footer.

create or replace view metrics.breakout_candidates as
with ranked as (
  select
    s.brand_id, s.network, s.content_type, s.external_id, s.captured_on,
    s.published_at, s.caption, s.permalink, s.thumbnail_url, s.age_days, s.views,
    row_number() over (
      partition by s.brand_id, s.network, s.content_type, s.external_id
      order by s.captured_on desc) as rn
  from metrics.snapshots_aged s
  where s.content_type <> 'stories'
    and s.published_at >= now() - interval '30 days'
),
cur as (select * from ranked where rn = 1),
prv as (
  select brand_id, network, content_type, external_id, captured_on, views
  from ranked where rn = 2
)
select
  cur.external_id,
  br.name       as brand_name,
  br.brand_type,
  bln.labels,
  cur.network,
  cur.content_type,
  cur.caption,
  cur.permalink,
  cur.thumbnail_url,
  cur.published_at,
  cur.age_days,
  cur.captured_on as captured_now,
  prv.captured_on as captured_prev,
  prv.views       as views_prev,
  cur.views       as views_now,
  cur.views - prv.views as views_gained,
  case when prv.views > 0
       then round(100.0 * (cur.views - prv.views)::numeric / prv.views::numeric, 1)
  end as views_pct_change,
  sp.views_multiple,
  sp.median_views,
  round((prv.views::double precision / nullif(sp.median_views, 0))::numeric, 1) as multiple_prev,
  cur.brand_id
from cur
  join metrics.brands br            on br.id = cur.brand_id
  join metrics.brand_label_names bln on bln.brand_id = br.id
  join metrics.scored_posts sp      on sp.external_id  = cur.external_id
                                   and sp.network      = cur.network
                                   and sp.content_type = cur.content_type
  left join prv on prv.brand_id     = cur.brand_id
               and prv.network      = cur.network
               and prv.content_type = cur.content_type
               and prv.external_id  = cur.external_id
where sp.sample_size >= 10
  and cur.views >= 10000
  -- raw ratio, not sp.views_multiple. views_multiple is rounded to 1dp, so a
  -- post at 2.4749x used to read as 2.5x here and as 2.4749x in the dedupe
  -- test - which is exactly how the same post alerted six times in eight days.
  and (cur.views::double precision / nullif(sp.median_views, 0)) >= 2.5;

comment on view metrics.breakout_candidates is
  'Every post currently over 10k views and 2.5x its account median. No send-history filter - this is the honest "how many are hot right now" count.';


create or replace view metrics.alerts as
with last_send as (
  select distinct on (external_id, network, content_type)
    external_id, network, content_type, sent_on, views_at_send
  from metrics.alert_sends
  order by external_id, network, content_type, sent_on desc, id desc
)
select
  c.external_id,
  c.brand_name,
  c.brand_type,
  c.labels,
  c.network,
  c.content_type,
  c.caption,
  c.permalink,
  c.thumbnail_url,
  c.published_at,
  c.age_days,
  c.captured_now,
  c.captured_prev,
  c.views_prev,
  c.views_now,
  c.views_gained,
  c.views_pct_change,
  c.views_multiple,
  c.median_views,
  c.multiple_prev,
  case when ls.external_id is null then 'breakout' else 'escalation' end as reason,
  ls.sent_on       as last_sent_on,
  ls.views_at_send as views_at_last_send,
  case when ls.views_at_send > 0
       then round(100.0 * (c.views_now - ls.views_at_send)::numeric
                  / ls.views_at_send::numeric, 0)
  end as growth_since_last_pct,
  (ls.external_id is not null) as is_reescalation,
  c.brand_id
from metrics.breakout_candidates c
  left join last_send ls on ls.external_id  = c.external_id
                        and ls.network      = c.network
                        and ls.content_type = c.content_type
where ls.external_id is null
   -- escalation bar: 1.5x the views it had when we last emailed about it.
   -- Change this number here and nowhere else.
   or c.views_now >= (ls.views_at_send * 1.5);

comment on view metrics.alerts is
  'Breakout candidates that are worth interrupting someone about: never emailed before, or up 50% on the views they had at the last email.';


create or replace view metrics.recent_breakouts as
with agg as (
  select external_id, network, content_type,
         min(sent_on) as first_sent_on,
         max(sent_on) as last_sent_on,
         count(*)     as send_count
  from metrics.alert_sends
  where sent_on >= current_date - 14
  group by 1, 2, 3
),
last_send as (
  select distinct on (external_id, network, content_type)
    external_id, network, content_type, views_at_send
  from metrics.alert_sends
  order by external_id, network, content_type, sent_on desc, id desc
)
select
  a.external_id,
  sp.brand_name,
  a.network,
  a.content_type,
  sp.caption,
  sp.permalink,
  sp.published_at,
  sp.views          as views_now,
  sp.views_multiple,
  sp.median_views,
  a.first_sent_on,
  a.last_sent_on,
  a.send_count,
  ls.views_at_send  as views_at_last_send,
  sp.views - ls.views_at_send as views_since_last_send
from agg a
  join last_send ls on ls.external_id  = a.external_id
                   and ls.network      = a.network
                   and ls.content_type = a.content_type
  join metrics.scored_posts sp on sp.external_id  = a.external_id
                              and sp.network      = a.network
                              and sp.content_type = a.content_type;

comment on view metrics.recent_breakouts is
  'Posts emailed as breakouts in the last 14 days, with where they have got to since. Feeds the footer of the alert email.';


-- digest.live_alerts used to count metrics.alerts, which now means "unsent".
-- Point it at the candidate set so the fortnightly digest keeps its meaning.
create or replace view metrics.digest as
select
  (select count(*) from metrics.scored_posts
    where published_at >= now() - interval '14 days')                       as posts_14d,
  (select sum(views) from metrics.scored_posts
    where published_at >= now() - interval '14 days')                       as views_14d,
  (select count(*) from metrics.breakout_candidates)                        as live_alerts,
  (select count(*) from metrics.scored_posts
    where published_at >= now() - interval '14 days'
      and views_multiple >= 2.5)                                            as above_baseline_14d,
  (select max(captured_on) from metrics.raw_snapshots)                      as last_pull;


alter view metrics.breakout_candidates set (security_invoker = true);
alter view metrics.alerts              set (security_invoker = true);
alter view metrics.recent_breakouts    set (security_invoker = true);

grant select on metrics.breakout_candidates to authenticated;
grant select on metrics.alerts              to authenticated;
grant select on metrics.recent_breakouts    to authenticated;

create or replace view public.mx_alerts as select * from metrics.alerts;

create or replace view public.mx_breakout_candidates as
  select * from metrics.breakout_candidates;

create or replace view public.mx_recent_breakouts as
  select * from metrics.recent_breakouts;

alter view public.mx_breakout_candidates set (security_invoker = true);
alter view public.mx_recent_breakouts    set (security_invoker = true);

grant select on public.mx_breakout_candidates to authenticated, service_role;
grant select on public.mx_recent_breakouts    to authenticated, service_role;

notify pgrst, 'reload schema';
