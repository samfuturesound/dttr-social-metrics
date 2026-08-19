create materialized view metrics.post_detail_mv as
  select b.id as brand_id, pd.*
  from metrics.post_detail pd
  left join metrics.brands b on b.name = pd.brand_name;

create unique index post_detail_mv_key
  on metrics.post_detail_mv (external_id, network, content_type);

create index post_detail_mv_brand_idx
  on metrics.post_detail_mv (brand_id);

create index post_detail_mv_labels_idx
  on metrics.post_detail_mv using gin (labels);

analyze metrics.post_detail_mv;
