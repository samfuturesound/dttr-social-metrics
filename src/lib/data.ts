import { supabase, MOCK } from "./supabase";
import { num } from "./format";
import { MOCK_ACCOUNT_SCORES, MOCK_BRANDS, MOCK_FLAGGED, MOCK_PERIOD } from "./mock";
import type {
  AccountScore,
  Brand,
  BrandPlatform,
  BrandSummary,
  FlaggedPost,
  Intervention,
  Period,
  PostDetail,
  PostNote,
  StreamingCapture,
} from "./types";

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

function mapPost(r: Record<string, unknown>): FlaggedPost {
  return {
    ...(r as unknown as FlaggedPost),
    views: num(r.views) ?? 0,
    median_views: num(r.median_views) ?? 0,
    views_multiple: num(r.views_multiple) ?? 0,
    engagement_pct: num(r.engagement_pct),
    skip_rate: num(r.skip_rate),
    age_days: num(r.age_days) ?? 0,
    avg_watch_seconds: num(r.avg_watch_seconds),
  };
}

async function fetchView(
  view: string,
  orderCol: string,
  ascending: boolean,
): Promise<FlaggedPost[]> {
  const { data, error } = await supabase
    .from(view)
    .select("*")
    .order(orderCol, { ascending });
  fail(error);
  return (data ?? []).map(mapPost);
}

/**
 * The post views all share one column shape:
 *  - mx_leading: top 10 by multiple, last 30 days — always fills
 *  - mx_recent: most recent posts per brand type (60 artist + 18 theme),
 *    not a fixed date window, so quiet accounts still show their last posts
 *  - mx_best: beating baseline, last 6 months
 *  - mx_top_views: top 10 by raw views, last 30 days
 */
export async function fetchLeading(): Promise<FlaggedPost[]> {
  if (MOCK) return MOCK_FLAGGED;
  return fetchView("mx_leading", "views_multiple", false);
}

export async function fetchRecent(): Promise<FlaggedPost[]> {
  if (MOCK)
    return [...MOCK_FLAGGED].sort((a, b) => a.age_days - b.age_days);
  return fetchView("mx_recent", "published_at", false);
}

export async function fetchBest(): Promise<FlaggedPost[]> {
  if (MOCK) return MOCK_FLAGGED;
  return fetchView("mx_best", "views_multiple", false);
}

/** Top 10 posts by raw views, last 30 days — reach, not outperformance. */
export async function fetchTopViews(): Promise<FlaggedPost[]> {
  if (MOCK) return [...MOCK_FLAGGED].sort((a, b) => b.views - a.views);
  return fetchView("mx_top_views", "views", false);
}

/** The 30-day window every view reports over. */
export async function fetchPeriod(): Promise<Period | null> {
  if (MOCK) return MOCK_PERIOD;
  const { data, error } = await supabase.from("mx_period").select("*").limit(1);
  fail(error);
  return (data?.[0] as Period) ?? null;
}

/** Per-account summed multiples over the period. */
export async function fetchAccountScores(): Promise<AccountScore[]> {
  if (MOCK) return MOCK_ACCOUNT_SCORES;
  const { data, error } = await supabase
    .from("mx_account_scores")
    .select("*")
    .order("total_score", { ascending: false });
  fail(error);
  return (data ?? []).map((r) => ({
    ...r,
    posts: num(r.posts) ?? 0,
    total_score: num(r.total_score) ?? 0,
    avg_multiple: num(r.avg_multiple) ?? 0,
    total_views: num(r.total_views) ?? 0,
    best_multiple: num(r.best_multiple),
  }));
}

export async function fetchNotes(ids: string[]): Promise<PostNote[]> {
  if (MOCK || ids.length === 0) return [];
  const { data, error } = await supabase
    .from("mx_notes")
    .select("*")
    .in("external_id", ids)
    .order("created_at", { ascending: false });
  fail(error);
  return data ?? [];
}

export async function fetchInterventions(
  ids: string[],
): Promise<Intervention[]> {
  if (MOCK || ids.length === 0) return [];
  const { data, error } = await supabase
    .from("mx_interventions")
    .select("*")
    .in("external_id", ids)
    .order("started_on", { ascending: false });
  fail(error);
  return (data ?? []).map((r) => ({ ...r, spend: num(r.spend) }));
}

export async function fetchStreaming(
  ids: string[],
): Promise<StreamingCapture[]> {
  if (MOCK || ids.length === 0) return [];
  const { data, error } = await supabase
    .from("mx_streaming")
    .select(
      "id, track_name, captured_on, period_label, streams, listeners, saves, playlist_adds, pct_active, screenshot_url, triggered_by_external_id, created_at",
    )
    .in("triggered_by_external_id", ids)
    .order("created_at", { ascending: false });
  fail(error);
  return (data ?? []).map((r) => ({
    ...r,
    streams: num(r.streams),
    listeners: num(r.listeners),
    saves: num(r.saves),
    playlist_adds: num(r.playlist_adds),
    pct_active: num(r.pct_active),
  }));
}

export async function fetchBrands(): Promise<Brand[]> {
  if (MOCK) return MOCK_BRANDS;
  const { data, error } = await supabase
    .from("mx_brands")
    .select("*")
    .order("brand_type")
    .order("name");
  fail(error);
  return data ?? [];
}

export async function addNote(externalId: string, note: string): Promise<void> {
  const { error } = await supabase.rpc("mx_add_note", {
    p_external_id: externalId,
    p_note: note,
    p_author: null,
  });
  fail(error);
}

export async function addIntervention(args: {
  externalId: string;
  kind: string;
  startedOn: string;
  endedOn: string | null;
  spend: number | null;
  notes: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc("mx_add_intervention", {
    p_external_id: args.externalId,
    p_kind: args.kind,
    p_started_on: args.startedOn,
    p_ended_on: args.endedOn,
    p_spend: args.spend,
    p_notes: args.notes,
    p_created_by: null,
  });
  fail(error);
}

export async function removeIntervention(id: string): Promise<void> {
  const { error } = await supabase.rpc("mx_remove_intervention", { p_id: id });
  fail(error);
}

export async function addBrand(args: {
  metricoolBlogId: string;
  name: string;
  brandType: string;
  owner: string;
  niche: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc("mx_add_brand", {
    p_metricool_blog_id: args.metricoolBlogId,
    p_name: args.name,
    p_brand_type: args.brandType,
    p_owner: args.owner,
    p_niche: args.niche,
  });
  fail(error);
}

export async function setBrandActive(
  brandId: string,
  active: boolean,
): Promise<void> {
  const { error } = await supabase.rpc("mx_set_brand_active", {
    p_brand_id: brandId,
    p_active: active,
  });
  fail(error);
}

/**
 * Upload a Spotify screenshot for a flagged post and run vision extraction.
 * The mx-spotify-vision edge function reads the file, extracts the numbers
 * with the Anthropic API and records them via mx_add_streaming_capture.
 */
export async function uploadStreamingCapture(
  externalId: string,
  file: File,
): Promise<StreamingCapture> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
  const path = `${externalId}/${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("mx-streaming")
    .upload(path, file, { contentType: file.type || "image/png" });
  fail(upErr);

  const { data, error } = await supabase.functions.invoke("mx-spotify-vision", {
    body: { path, external_id: externalId },
  });
  if (error) throw new Error(error.message ?? "Vision extraction failed");
  if (data?.error) throw new Error(data.error);
  return data.capture as StreamingCapture;
}

/** Every post for one brand, all history, newest first. */
export async function fetchPostDetail(brand: string): Promise<PostDetail[]> {
  if (MOCK) {
    return MOCK_FLAGGED.filter((p) => p.brand_name === brand).map((p) => ({
      ...p,
      follows: null,
      reach: null,
      duration_seconds: 20,
      weighted_engagement: 80,
      engagement_rate: 8.4,
      completion_pct: 21,
      engagement_multiple: 1.2,
      median_engagement_rate: 7.1,
      median_completion_pct: 18,
    }));
  }
  const { data, error } = await supabase
    .from("mx_post_detail")
    .select("*")
    .eq("brand_name", brand)
    .order("published_at", { ascending: false });
  fail(error);
  return (data ?? []).map((r) => ({
    ...mapPost(r),
    follows: num(r.follows),
    reach: num(r.reach),
    duration_seconds: num(r.duration_seconds),
    weighted_engagement: num(r.weighted_engagement),
    engagement_rate: num(r.engagement_rate),
    completion_pct: num(r.completion_pct),
    engagement_multiple: num(r.engagement_multiple),
    median_engagement_rate: num(r.median_engagement_rate),
    median_completion_pct: num(r.median_completion_pct),
  }));
}

export async function fetchBrandSummary(
  brand: string,
): Promise<BrandSummary | null> {
  if (MOCK) {
    return {
      brand_id: 1, brand_name: brand, brand_type: "artist", owner: "Sam",
      niche: null, active: true, metricool_blog_id: "0",
      posts_all_time: 75, views_all_time: 1294142, posts_3m: 16,
      views_3m: 132904, platforms: 2, first_post: "2025-08-15",
      last_post: "2026-07-28",
    };
  }
  const { data, error } = await supabase
    .from("mx_brand_summary")
    .select("*")
    .eq("brand_name", brand)
    .limit(1);
  fail(error);
  const r = data?.[0];
  if (!r) return null;
  return {
    ...r,
    posts_all_time: num(r.posts_all_time) ?? 0,
    views_all_time: num(r.views_all_time) ?? 0,
    posts_3m: num(r.posts_3m) ?? 0,
    views_3m: num(r.views_3m) ?? 0,
    platforms: num(r.platforms) ?? 0,
  };
}

/** Per-platform, per-format medians — the comparison a pooled number destroys. */
export async function fetchBrandPlatform(
  brand: string,
): Promise<BrandPlatform[]> {
  if (MOCK) {
    return [
      { brand_id: 1, brand_name: brand, brand_type: "artist",
        network: "tiktok", content_type: "posts", posts: 51, views: 43096,
        median_views: 665, median_engagement_rate: 11.2,
        median_completion_pct: null, completion_available: 0,
        last_post: "2026-05-27" },
      { brand_id: 1, brand_name: brand, brand_type: "artist",
        network: "instagram", content_type: "reels", posts: 7, views: 178653,
        median_views: 26326, median_engagement_rate: 10.4,
        median_completion_pct: 18.1, completion_available: 5,
        last_post: "2026-05-20" },
    ];
  }
  const { data, error } = await supabase
    .from("mx_brand_platform_summary")
    .select("*")
    .eq("brand_name", brand)
    .order("posts", { ascending: false });
  fail(error);
  return (data ?? []).map((r) => ({
    ...r,
    posts: num(r.posts) ?? 0,
    views: num(r.views) ?? 0,
    median_views: num(r.median_views),
    median_engagement_rate: num(r.median_engagement_rate),
    median_completion_pct: num(r.median_completion_pct),
    completion_available: num(r.completion_available) ?? 0,
  }));
}
