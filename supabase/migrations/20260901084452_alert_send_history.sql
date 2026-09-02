-- Persistent record of which posts have actually been emailed as breakouts,
-- and what their view count was at the moment we sent. This replaces the
-- snapshot-pair "crossing" test, which re-fired every time a post wobbled
-- across the 2.5x line.

create table if not exists metrics.alert_sends (
  id               bigserial primary key,
  external_id      text        not null,
  network          text        not null,
  content_type     text        not null,
  brand_id         bigint      references metrics.brands(id),
  views_at_send    bigint      not null,
  multiple_at_send numeric,
  sent_on          date        not null default current_date,
  sent_at          timestamptz not null default now()
);

comment on table metrics.alert_sends is
  'One row per breakout email sent about a post. views_at_send is the bar the post must clear again (x1.5) before it is allowed to interrupt anyone a second time.';

-- one claim per post per day, so a re-run of FS-8 on the same day is a no-op
create unique index if not exists alert_sends_post_day_uidx
  on metrics.alert_sends (external_id, network, content_type, sent_on);

-- supports the "most recent send for this post" lookup
create index if not exists alert_sends_post_recent_idx
  on metrics.alert_sends (external_id, network, content_type, sent_on desc);

alter table metrics.alert_sends enable row level security;

-- NB: mx_is_internal() wrapped in a subselect on purpose - without it the
-- function re-evaluates once per row. Do not unwrap this.
drop policy if exists mx_internal_read on metrics.alert_sends;
create policy mx_internal_read on metrics.alert_sends
  for select to authenticated
  using ((select public.mx_is_internal()));

grant select on metrics.alert_sends to authenticated;
grant select, insert on metrics.alert_sends to service_role;
grant usage, select on sequence metrics.alert_sends_id_seq to service_role;
