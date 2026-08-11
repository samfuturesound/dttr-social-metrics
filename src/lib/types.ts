export type BrandType = "artist" | "theme";

export interface FlaggedPost {
  external_id: string;
  brand_name: string;
  brand_type: BrandType;
  owner: string | null;
  network: string;
  content_type: string;
  caption: string | null;
  permalink: string | null;
  thumbnail_url: string | null;
  published_at: string;
  age_days: number;
  views: number;
  median_views: number;
  views_multiple: number;
  engagement_pct: number | null;
  skip_rate: number | null;
  sample_size: number;
  assisted_from: string | null;
  assist_kinds: string[] | null;
  is_assisted: boolean;
  /** Joined from mx_snapshots (latest capture) — reels only. */
  avg_watch_seconds: number | null;
}

export interface Brand {
  id: string;
  metricool_blog_id: number;
  name: string;
  brand_type: BrandType;
  owner: string | null;
  active: boolean;
}

export interface PostNote {
  id: string;
  external_id: string;
  note: string;
  author: string | null;
  created_at: string;
}

export interface Intervention {
  id: string;
  external_id: string;
  kind: "meta_ads" | "tiktok_ads" | "clipping" | "other";
  started_on: string;
  ended_on: string | null;
  spend: number | null;
  currency: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface StreamingCapture {
  id: string;
  track_name: string | null;
  captured_on: string | null;
  period_label: string | null;
  streams: number | null;
  listeners: number | null;
  saves: number | null;
  playlist_adds: number | null;
  pct_active: number | null;
  screenshot_url: string | null;
  triggered_by_external_id: string | null;
  created_at: string;
}

export const INTERVENTION_KINDS = [
  "meta_ads",
  "tiktok_ads",
  "clipping",
  "other",
] as const;

export const INTERVENTION_LABELS: Record<Intervention["kind"], string> = {
  meta_ads: "Meta ads",
  tiktok_ads: "TikTok ads",
  clipping: "Clipping",
  other: "Other",
};

export interface Period {
  period_start: string;
  period_end: string;
  period_days: number;
}

export interface AccountScore {
  brand_name: string;
  brand_type: BrandType;
  owner: string | null;
  posts: number;
  total_score: number;
  avg_multiple: number;
  total_views: number;
  best_multiple: number | null;
}

/** mx_post_detail row — every post, all history, engagement columns included. */
export interface PostDetail extends FlaggedPost {
  follows: number | null;
  reach: number | null;
  duration_seconds: number | null;
  weighted_engagement: number | null;
  engagement_rate: number | null;
  completion_pct: number | null;
  engagement_multiple: number | null;
  median_engagement_rate: number | null;
  median_completion_pct: number | null;
}

/** mx_brand_summary row — per-brand headline figures. */
export interface BrandSummary {
  brand_id: number;
  brand_name: string;
  brand_type: BrandType;
  owner: string | null;
  niche: string | null;
  active: boolean;
  metricool_blog_id: string;
  posts_all_time: number;
  views_all_time: number;
  posts_3m: number;
  views_3m: number;
  median_views: number | null;
  median_engagement_rate: number | null;
  median_completion_pct: number | null;
  first_post: string | null;
  last_post: string | null;
}
