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
  labels: string[];
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
  labels: string[];
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

/** mx_brand_summary row — per-brand headline figures (no pooled medians:
 * a median across TikTok and Instagram together is meaningless). */
export interface BrandSummary {
  brand_id: number;
  brand_name: string;
  labels: string[];
  brand_type: BrandType;
  owner: string | null;
  niche: string | null;
  active: boolean;
  metricool_blog_id: string;
  posts_all_time: number;
  views_all_time: number;
  posts_3m: number;
  views_3m: number;
  platforms: number;
  first_post: string | null;
  last_post: string | null;
}

/** mx_brand_platform_summary row — medians per brand per network per format. */
export interface BrandPlatform {
  brand_id: number;
  brand_name: string;
  brand_type: BrandType;
  network: string;
  content_type: string;
  posts: number;
  views: number;
  median_views: number | null;
  median_engagement_rate: number | null;
  median_completion_pct: number | null;
  completion_available: number;
  last_post: string | null;
}

/** Minimal shape a post row needs to render — satisfied by both the internal
 * PostDetail and the public SharePost (which carries no assist fields). */
export interface RowPost {
  external_id: string;
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
  is_assisted?: boolean;
  assisted_from?: string | null;
}

/** mx_share_posts row — deliberately excludes assist flags, spend, owner and
 * notes. The public route must never render those. */
export interface SharePost extends RowPost {
  brand_name: string;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  engagement_rate: number | null;
  engagement_multiple: number | null;
  completion_pct: number | null;
  skip_rate: number | null;
}

/** mx_share_summary row — one per network + content type. */
export interface ShareSummary {
  brand_name: string;
  network: string;
  content_type: string;
  posts: number;
  views: number;
  median_views: number | null;
  median_engagement_rate: number | null;
  median_completion_pct: number | null;
  last_post: string | null;
}

/** mx_list_shares row. */
export interface ShareLink {
  id: number;
  brand_id: number;
  brand_name: string;
  token: string;
  label: string | null;
  created_at: string;
  expires_on: string | null;
  revoked: boolean;
}

/**
 * mx_brand_platform_ranks — the platform summary plus the brand's position
 * within each cohort. INTERNAL ONLY: never fetched or rendered on the public
 * share route, which uses mx_share_summary (no rank columns at all).
 *
 * Every rank is scoped to the same network AND content type, and each
 * denominator counts only brands with data in that cohort.
 */
export interface BrandPlatformRanks extends BrandPlatform {
  rank_views_all: number | null;
  total_views_all: number;
  rank_views_type: number | null;
  total_views_type: number;
  rank_eng_all: number | null;
  total_eng_all: number;
  rank_eng_type: number | null;
  total_eng_type: number;
  rank_completion_all: number | null;
  total_completion_all: number;
  rank_completion_type: number | null;
  total_completion_type: number;
}

/** mx_labels row. Labels are many-to-many: a brand can carry several. */
export interface Label {
  label_id: number;
  name: string;
  slug: string;
  brands: number;
  active_brands: number;
  artist_brands: number;
  theme_brands: number;
}

/** mx_list_label_shares row. */
export interface LabelShareLink {
  id: number;
  label: string;
  token: string;
  note: string | null;
  created_at: string;
  expires_on: string | null;
  revoked: boolean;
}

/** mx_label_share_summary row — per brand per platform, no ranks. */
export interface LabelShareSummary {
  brand_name: string;
  network: string;
  content_type: string;
  posts: number;
  views: number;
  median_views: number | null;
  median_engagement_rate: number | null;
  median_completion_pct: number | null;
  last_post: string | null;
}

/** mx_skip_roster — one row, roster-wide skip benchmarks. Internal only. */
export interface SkipRoster {
  reels_counted: number;
  roster_median: number;
  best_skip_rate: number;
  worst_skip_rate: number;
}

/** mx_brand_skip_rates — per brand + network + format median skip rate. */
export interface BrandSkipRate {
  brand_name: string;
  network: string;
  content_type: string;
  reels_counted: number;
  median_skip_rate: number | null;
}

/** mx_ai_queries row — the question log shown on /ask. */
export interface AiQuery {
  id: number;
  asked_at: string;
  question: string;
  brand_filter: string | null;
  error: string | null;
}

export interface AiAnswer {
  answer: string;
  posts: number;
  tokens_in?: number;
  tokens_out?: number;
  truncated?: boolean;
}
