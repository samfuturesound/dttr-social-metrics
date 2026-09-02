-- post_detail_mv_key assumed external_id was globally unique. It isn't:
-- metrics.post_detail is grained per brand, so the same post appears once
-- per brand tracking it. Two brands pointing at overlapping Metricool data
-- -- whether by mistake or legitimately, e.g. a co-release carried under
-- both an artist and a label brand -- produced a duplicate key and broke
-- REFRESH MATERIALIZED VIEW CONCURRENTLY, silently freezing every share
-- link from 31 August 2026.
--
-- The key must match the view's grain. Verified zero duplicates on the
-- wider key against live data (1,101 rows) before applying.

drop index if exists metrics.post_detail_mv_key;

create unique index post_detail_mv_key
  on metrics.post_detail_mv (brand_name, external_id, network, content_type);

comment on index metrics.post_detail_mv_key is
  'Must include brand_name: post_detail is grained per brand and external_id is only unique within one. Narrowing this breaks the nightly concurrent refresh.';
