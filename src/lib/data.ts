import { supabase, MOCK } from "./supabase";
import { num } from "./format";
import { MOCK_BRANDS, MOCK_FLAGGED } from "./mock";
import type {
  Brand,
  FlaggedPost,
  Intervention,
  PostNote,
  StreamingCapture,
} from "./types";

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

/**
 * Flagged posts, sorted by views_multiple desc. Reads mx_flagged_interim
 * (median-based, works on backfilled data); switch the view name to
 * mx_flagged once ~4 weeks of daily snapshots exist.
 *
 * avg_watch_seconds lives on mx_snapshots, not the interim view, so it is
 * joined in here for reels (latest capture per item).
 */
export async function fetchFlagged(): Promise<FlaggedPost[]> {
  if (MOCK) return MOCK_FLAGGED;

  const { data, error } = await supabase
    .from("mx_flagged_interim")
    .select("*")
    .order("views_multiple", { ascending: false });
  fail(error);

  const posts: FlaggedPost[] = (data ?? []).map((r) => ({
    ...r,
    views: num(r.views) ?? 0,
    median_views: num(r.median_views) ?? 0,
    views_multiple: num(r.views_multiple) ?? 0,
    engagement_pct: num(r.engagement_pct),
    skip_rate: num(r.skip_rate),
    age_days: num(r.age_days) ?? 0,
    avg_watch_seconds: null,
  }));

  const reelIds = posts
    .filter((p) => p.content_type === "reels")
    .map((p) => p.external_id);
  if (reelIds.length > 0) {
    const { data: snaps, error: snapErr } = await supabase
      .from("mx_snapshots")
      .select("external_id, avg_watch_seconds, captured_on")
      .in("external_id", reelIds)
      .order("captured_on", { ascending: false });
    fail(snapErr);
    const latest = new Map<string, number | null>();
    for (const s of snaps ?? []) {
      if (!latest.has(s.external_id))
        latest.set(s.external_id, num(s.avg_watch_seconds));
    }
    for (const p of posts) {
      if (latest.has(p.external_id))
        p.avg_watch_seconds = latest.get(p.external_id) ?? null;
    }
  }
  return posts;
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
