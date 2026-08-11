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
 * All three flagged/feed views share one column shape:
 *  - mx_flagged_interim: beating baseline, last 30 days (switch to mx_flagged
 *    once ~4 weeks of daily snapshots exist)
 *  - mx_recent: every post from the last 14 days, no threshold
 *  - mx_best: beating baseline, last 12 months
 */
export async function fetchFlagged(): Promise<FlaggedPost[]> {
  if (MOCK) return MOCK_FLAGGED;
  return fetchView("mx_flagged_interim", "views_multiple", false);
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
