create index if not exists raw_snapshots_latest_per_post_idx
  on metrics.raw_snapshots (brand_id, network, content_type, external_id, captured_on desc);
analyze metrics.raw_snapshots;
