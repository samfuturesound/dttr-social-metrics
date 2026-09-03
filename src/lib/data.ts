import { supabase, MOCK } from "./supabase";
import { num } from "./format";
import type { Database } from "./database.types";
import {
  MOCK_ACCOUNT_SCORES,
  MOCK_BRANDS,
  MOCK_FLAGGED,
  MOCK_PERIOD,
  MOCK_TREND,
} from "./mock";
import type {
  AccountScore,
  AiAnswer,
  AiQuery,
  Brand,
  BrandSkipRate,
  SkipRoster,
  Label,
  LabelShareLink,
  LabelShareSummary,
  BrandPlatform,
  BrandPlatformRanks,
  BrandSummary,
  ShareLink,
  SharePost,
  ShareSummary,
  FlaggedPost,
  Intervention,
  Period,
  PostDetail,
  PostNote,
  StreamingCapture,
  TrendRow,
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

/** Used by the post detail panel, which keeps the fuller intervention record
 *  (kind, dates, spend, notes). The row control is the plain paid toggle below. */
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

/**
 * Marks a post paid, or clears the mark. Returns the resulting state as the
 * function reports it — callers should use that rather than assuming the click
 * took effect. Idempotent, so a double click is harmless.
 *
 * authenticated only. anon holds no execute grant on mx_set_paid, so a share
 * page cannot reach this even if a control were ever rendered on one.
 */
export async function setPaid(
  externalId: string,
  paid: boolean,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("mx_set_paid", {
    p_external_id: externalId,
    p_paid: paid,
  });
  fail(error);
  return data === true;
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
      brand_id: 1, brand_name: brand, labels: ["Dance to the Radio"],
      brand_type: "artist", owner: "Sam",
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


/* ---------- Public share links ----------
 * mx_share_summary / mx_share_posts are granted to anon and take the token
 * as their only argument, so these work with no session. An unknown, revoked
 * or expired token returns zero rows rather than an error.
 */

export async function fetchShareSummary(
  token: string,
): Promise<ShareSummary[]> {
  const { data, error } = await supabase.rpc("mx_share_summary", {
    p_token: token,
  });
  fail(error);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    ...(r as unknown as ShareSummary),
    posts: num(r.posts) ?? 0,
    views: num(r.views) ?? 0,
    median_views: num(r.median_views),
    median_engagement_rate: num(r.median_engagement_rate),
    median_completion_pct: num(r.median_completion_pct),
  }));
}

export async function fetchSharePosts(token: string): Promise<SharePost[]> {
  const { data, error } = await supabase.rpc("mx_share_posts", {
    p_token: token,
  });
  fail(error);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    ...(r as unknown as SharePost),
    views: num(r.views) ?? 0,
    median_views: num(r.median_views) ?? 0,
    views_multiple: num(r.views_multiple) ?? 0,
    age_days: num(r.age_days) ?? 0,
    likes: num(r.likes),
    comments: num(r.comments),
    shares: num(r.shares),
    saves: num(r.saves),
    engagement_rate: num(r.engagement_rate),
    engagement_multiple: num(r.engagement_multiple),
    completion_pct: num(r.completion_pct),
    skip_rate: num(r.skip_rate),
  }));
}

/**
 * Resolve a share token to its brand id, or null.
 *
 * This is what separates "the link is dead" from "the link is fine, the
 * account just has no figures yet". mx_share_brand_id returns null only when
 * the token is unknown, revoked, or past expires_on — a valid token for a
 * brand with no rows in post_detail_mv still returns its brand_id. Row counts
 * from mx_share_posts cannot tell those apart, because both come back empty.
 *
 * Granted to anon, and a single indexed lookup on brand_shares. The share
 * pages issue it inside the same Promise.all as the other two calls, so it
 * costs no additional wall-clock time.
 */
export async function fetchShareBrandId(token: string): Promise<number | null> {
  const { data, error } = await supabase.rpc("mx_share_brand_id", {
    p_token: token,
  });
  fail(error);
  return num(data) ?? null;
}

/* ---------- Monthly trend ---------- */

/**
 * The row shapes the trend sources actually return, taken from the generated
 * schema types rather than restated by hand. mx_share_trend and
 * mx_label_share_trend gained paid_excluded as a trailing column; because these
 * are mapped by name the append order is irrelevant, but pinning the types here
 * means a future signature change fails the build instead of silently mapping
 * to undefined.
 */
type TrendViewRow = Database["public"]["Views"]["mx_trend"]["Row"];
type ShareTrendRow =
  Database["public"]["Functions"]["mx_share_trend"]["Returns"][number];
type LabelShareTrendRow =
  Database["public"]["Functions"]["mx_label_share_trend"]["Returns"][number];

type TrendRpcRow = TrendViewRow | ShareTrendRow | LabelShareTrendRow;

function trendRow(r: TrendRpcRow, brand: string): TrendRow {
  // brand_name and labels are on mx_trend and the label share only — a brand
  // share is a single account, so those come from the caller instead. Reached
  // through a cast because they are genuinely absent from one member.
  const partial = r as Partial<TrendViewRow>;
  return {
    brand_name: partial.brand_name ?? brand,
    labels: partial.labels ?? null,
    // Everything below is read off the typed union, so if a regeneration ever
    // drops one of these columns this stops compiling rather than quietly
    // mapping to undefined.
    network: r.network as string,
    content_type: r.content_type as string,
    month: r.month as string,
    posts: num(r.posts) ?? 0,
    median_views: num(r.median_views),
    median_engagement_rate: num(r.median_engagement_rate),
    growth_multiple: num(r.growth_multiple),
    // A month with no paid posts reports 0, not null. Coalescing anyway so a
    // missing count reads as "none excluded", never as a spurious annotation.
    paid_excluded: num(r.paid_excluded) ?? 0,
  };
}

/**
 * The whole trend view — 59 rows across every brand, platform and month.
 *
 * Small enough to fetch once and slice in the browser, so the dashboard, brand
 * pages and label pages all share one request rather than one per filter. The
 * promise itself is cached, so concurrent callers on first paint coalesce
 * instead of racing.
 */
let trendCache: Promise<TrendRow[]> | null = null;

export function fetchTrend(): Promise<TrendRow[]> {
  if (MOCK) return Promise.resolve(MOCK_TREND);
  if (!trendCache) {
    trendCache = (async () => {
      const { data, error } = await supabase.from("mx_trend").select("*");
      fail(error);
      return (data ?? []).map((r: TrendViewRow) => trendRow(r, ""));
    })().catch((e) => {
      trendCache = null; // never cache a failure — the next mount retries
      throw e;
    });
  }
  return trendCache;
}

/**
 * Brand share route. Returns no brand column — a share is one account — so
 * rows come back with an empty brand_name and the page fills it from the name
 * it already has. That avoids a second call purely to learn the label.
 */
export async function fetchShareTrend(token: string): Promise<TrendRow[]> {
  const { data, error } = await supabase.rpc("mx_share_trend", {
    p_token: token,
  });
  fail(error);
  return (data ?? []).map((r: ShareTrendRow) => trendRow(r, ""));
}

/** Label share route. Carries brand_name, since a label spans accounts. */
export async function fetchLabelShareTrend(token: string): Promise<TrendRow[]> {
  const { data, error } = await supabase.rpc("mx_label_share_trend", {
    p_token: token,
  });
  fail(error);
  return (data ?? []).map((r: LabelShareTrendRow) => trendRow(r, ""));
}

/* ---------- Share management (internal only) ---------- */

/**
 * Rebuild post_detail_mv on demand. Needed after adding a brand: its posts
 * don't reach the materialized view until the 03:30 cron otherwise.
 *
 * authenticated only — never anon. REFRESH ... CONCURRENTLY, so readers of
 * the share pages are not blocked while it runs.
 */
export async function refreshDerived(): Promise<string> {
  const { data, error } = await supabase.rpc("mx_refresh_derived");
  fail(error);
  return (data as string) ?? "refreshed";
}

export async function listShares(): Promise<ShareLink[]> {
  if (MOCK) return [];
  const { data, error } = await supabase.rpc("mx_list_shares");
  fail(error);
  return data ?? [];
}

export async function createShare(args: {
  brandId: number;
  label: string | null;
  expiresOn: string | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc("mx_create_share", {
    p_brand_id: args.brandId,
    p_label: args.label,
    p_expires_on: args.expiresOn,
  });
  fail(error);
  return data as string;
}

export async function revokeShare(id: number): Promise<void> {
  const { error } = await supabase.rpc("mx_revoke_share", { p_id: id });
  fail(error);
}


/**
 * Per-platform medians plus roster ranks — the internal brand page only.
 * The public share route must never call this; it uses fetchShareSummary,
 * whose function returns no rank columns.
 */
export async function fetchBrandPlatformRanks(
  brand: string,
): Promise<BrandPlatformRanks[]> {
  if (MOCK) {
    const base = await fetchBrandPlatform(brand);
    return base.map((r, i) => ({
      ...r,
      rank_views_all: i + 1, total_views_all: 8,
      rank_views_type: i + 1, total_views_type: 5,
      rank_eng_all: i + 2, total_eng_all: 8,
      rank_eng_type: i + 1, total_eng_type: 5,
      rank_completion_all: r.median_completion_pct !== null ? 4 : 1,
      total_completion_all: r.median_completion_pct !== null ? 8 : 0,
      rank_completion_type: r.median_completion_pct !== null ? 4 : 1,
      total_completion_type: r.median_completion_pct !== null ? 8 : 0,
    }));
  }
  const { data, error } = await supabase
    .from("mx_brand_platform_ranks")
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
    rank_views_all: num(r.rank_views_all),
    total_views_all: num(r.total_views_all) ?? 0,
    rank_views_type: num(r.rank_views_type),
    total_views_type: num(r.total_views_type) ?? 0,
    rank_eng_all: num(r.rank_eng_all),
    total_eng_all: num(r.total_eng_all) ?? 0,
    rank_eng_type: num(r.rank_eng_type),
    total_eng_type: num(r.total_eng_type) ?? 0,
    rank_completion_all: num(r.rank_completion_all),
    total_completion_all: num(r.total_completion_all) ?? 0,
    rank_completion_type: num(r.rank_completion_type),
    total_completion_type: num(r.total_completion_type) ?? 0,
  }));
}


/* ---------- Labels (many-to-many) ---------- */

export async function fetchLabels(): Promise<Label[]> {
  if (MOCK) return [];
  const { data, error } = await supabase
    .from("mx_labels")
    .select("*")
    .order("name");
  fail(error);
  return (data ?? []).map((r) => ({
    ...r,
    brands: num(r.brands) ?? 0,
    active_brands: num(r.active_brands) ?? 0,
    artist_brands: num(r.artist_brands) ?? 0,
    theme_brands: num(r.theme_brands) ?? 0,
  }));
}

export async function setBrandLabel(
  brandId: string,
  labelName: string,
  on: boolean,
): Promise<void> {
  const { error } = await supabase.rpc("mx_set_brand_label", {
    p_brand_id: brandId,
    p_label_name: labelName,
    p_on: on,
  });
  fail(error);
}

export async function addLabel(name: string): Promise<void> {
  const { error } = await supabase.rpc("mx_add_label", { p_name: name });
  fail(error);
}

/** Any post view, filtered to rows whose labels array contains this label. */
async function fetchLabelView(
  view: string,
  label: string,
  orderCol: string,
): Promise<PostDetail[]> {
  const { data, error } = await supabase
    .from(view)
    .select("*")
    .contains("labels", [label])
    .order(orderCol, { ascending: false });
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

export function fetchLabelPosts(label: string): Promise<PostDetail[]> {
  return fetchLabelView("mx_post_detail", label, "published_at");
}

/** Per-brand, per-platform medians + ranks for every brand under a label. */
export async function fetchLabelPlatformRanks(
  label: string,
): Promise<BrandPlatformRanks[]> {
  const { data, error } = await supabase
    .from("mx_brand_platform_ranks")
    .select("*")
    .contains("labels", [label])
    .order("brand_name")
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
    rank_views_all: num(r.rank_views_all),
    total_views_all: num(r.total_views_all) ?? 0,
    rank_views_type: num(r.rank_views_type),
    total_views_type: num(r.total_views_type) ?? 0,
    rank_eng_all: num(r.rank_eng_all),
    total_eng_all: num(r.total_eng_all) ?? 0,
    rank_eng_type: num(r.rank_eng_type),
    total_eng_type: num(r.total_eng_type) ?? 0,
    rank_completion_all: num(r.rank_completion_all),
    total_completion_all: num(r.total_completion_all) ?? 0,
    rank_completion_type: num(r.rank_completion_type),
    total_completion_type: num(r.total_completion_type) ?? 0,
  }));
}

/* ---------- Label shares ---------- */

export async function fetchLabelShareSummary(
  token: string,
): Promise<LabelShareSummary[]> {
  const { data, error } = await supabase.rpc("mx_label_share_summary", {
    p_token: token,
  });
  fail(error);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    ...(r as unknown as LabelShareSummary),
    posts: num(r.posts) ?? 0,
    views: num(r.views) ?? 0,
    median_views: num(r.median_views),
    median_engagement_rate: num(r.median_engagement_rate),
    median_completion_pct: num(r.median_completion_pct),
  }));
}

export async function fetchLabelSharePosts(
  token: string,
): Promise<SharePost[]> {
  const { data, error } = await supabase.rpc("mx_label_share_posts", {
    p_token: token,
  });
  fail(error);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    ...(r as unknown as SharePost),
    views: num(r.views) ?? 0,
    median_views: num(r.median_views) ?? 0,
    views_multiple: num(r.views_multiple) ?? 0,
    age_days: num(r.age_days) ?? 0,
    likes: num(r.likes),
    comments: num(r.comments),
    shares: num(r.shares),
    saves: num(r.saves),
    engagement_rate: num(r.engagement_rate),
    engagement_multiple: num(r.engagement_multiple),
    completion_pct: num(r.completion_pct),
    skip_rate: num(r.skip_rate),
  }));
}

export async function listLabelShares(): Promise<LabelShareLink[]> {
  if (MOCK) return [];
  const { data, error } = await supabase.rpc("mx_list_label_shares");
  fail(error);
  return data ?? [];
}

export async function createLabelShare(args: {
  label: string;
  note: string | null;
  expiresOn: string | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc("mx_create_label_share", {
    p_label: args.label,
    p_note: args.note,
    p_expires_on: args.expiresOn,
  });
  fail(error);
  return data as string;
}

export async function revokeLabelShare(id: number): Promise<void> {
  const { error } = await supabase.rpc("mx_revoke_label_share", { p_id: id });
  fail(error);
}

/** Label name behind a share token — mx_label_share_summary returns brand
 *  rows only, so the heading comes from here. Null when the token is dead. */
export async function fetchLabelShareName(
  token: string,
): Promise<string | null> {
  const { data, error } = await supabase.rpc("mx_label_share_name", {
    p_token: token,
  });
  fail(error);
  return (data as string) ?? null;
}


/* ---------- Skip rate benchmarks (internal only) ----------
 * Never fetched by the public share pages — they don't render skip rate, and
 * the roster figures are comparative information an artist shouldn't see.
 */

export async function fetchSkipRoster(): Promise<SkipRoster | null> {
  if (MOCK) {
    return {
      reels_counted: 143, roster_median: 68.6,
      best_skip_rate: 39.7, worst_skip_rate: 91.3,
    };
  }
  const { data, error } = await supabase
    .from("mx_skip_roster")
    .select("*")
    .limit(1);
  fail(error);
  const r = data?.[0];
  if (!r) return null;
  return {
    reels_counted: num(r.reels_counted) ?? 0,
    roster_median: num(r.roster_median) ?? 0,
    best_skip_rate: num(r.best_skip_rate) ?? 0,
    worst_skip_rate: num(r.worst_skip_rate) ?? 0,
  };
}

/** Median skip rate per brand — optionally narrowed to one brand. */
export async function fetchBrandSkipRates(
  brand?: string,
): Promise<BrandSkipRate[]> {
  if (MOCK) return [];
  let q = supabase.from("mx_brand_skip_rates").select("*");
  if (brand) q = q.eq("brand_name", brand);
  const { data, error } = await q;
  fail(error);
  return (data ?? []).map((r) => ({
    ...r,
    reels_counted: num(r.reels_counted) ?? 0,
    median_skip_rate: num(r.median_skip_rate),
  }));
}


/* ---------- AI summarise (internal only) ----------
 * mx_ai_context and mx_log_ai_query have EXECUTE revoked from PUBLIC — the
 * mx-ai-summarise edge function is their only caller, using the service-role
 * key after checking the caller is the internal account.
 */

export async function askAI(args: {
  question: string;
  brand: string | null;
  days: number;
}): Promise<AiAnswer> {
  const { data, error } = await supabase.functions.invoke("mx-ai-summarise", {
    body: { question: args.question, brand: args.brand, days: args.days },
  });
  // supabase-js surfaces non-2xx as FunctionsHttpError with the body hidden,
  // so read the response for the server's own message where we can.
  if (error) {
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      const body = await ctx.json().catch(() => null);
      if (body?.error) throw new Error(body.error);
    }
    throw new Error(error.message ?? "The question could not be answered.");
  }
  if (data?.error) throw new Error(data.error);
  return data as AiAnswer;
}

export async function fetchAiQueries(limit = 8): Promise<AiQuery[]> {
  if (MOCK) return [];
  const { data, error } = await supabase
    .from("mx_ai_queries")
    .select("*")
    .order("asked_at", { ascending: false })
    .limit(limit);
  fail(error);
  return data ?? [];
}
