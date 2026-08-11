// mx-spotify-vision — extract Spotify for Artists stats from a screenshot.
//
// Called by the DTTR social metrics page after uploading a screenshot to the
// private `mx-streaming` bucket. Reads the image with the caller's own auth
// (so storage policies and the mx_add_streaming_capture grant apply), extracts
// the numbers with the Anthropic API, records them via mx_add_streaming_capture
// and returns the parsed capture.
//
// Secrets required: ANTHROPIC_API_KEY. Only the mx-internal service account
// (issued by mx-login) may call this.

import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const MEDIA_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

const EXTRACT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "track_name",
    "captured_on",
    "period_label",
    "streams",
    "listeners",
    "saves",
    "playlist_adds",
    "src_library",
    "src_external",
    "src_search",
    "src_queue",
    "src_algorithmic",
    "src_editorial",
  ],
  properties: {
    track_name: { type: ["string", "null"] },
    captured_on: {
      type: ["string", "null"],
      description: "Date the stats were captured, YYYY-MM-DD, if visible",
    },
    period_label: {
      type: ["string", "null"],
      description: "Period the stats cover, e.g. 'Last 28 days' or '7 days'",
    },
    streams: { type: ["integer", "null"] },
    listeners: { type: ["integer", "null"] },
    saves: { type: ["integer", "null"] },
    playlist_adds: { type: ["integer", "null"] },
    src_library: { type: ["integer", "null"] },
    src_external: { type: ["integer", "null"] },
    src_search: { type: ["integer", "null"] },
    src_queue: { type: ["integer", "null"] },
    src_algorithmic: { type: ["integer", "null"] },
    src_editorial: { type: ["integer", "null"] },
  },
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { path, external_id } = await req.json();
    if (!path || typeof path !== "string") {
      return json({ error: "Missing 'path'" }, 400);
    }

    // Client acting as the caller — storage read + RPC run under their auth.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization") ?? "" },
        },
      },
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return json({ error: "Not authenticated" }, 401);
    }
    if (userData.user.email?.toLowerCase() !== "mx-internal@dttrsocialmetrics.app") {
      return json({ error: "Not authorized" }, 403);
    }

    const { data: blob, error: dlErr } = await supabase.storage
      .from("mx-streaming")
      .download(path);
    if (dlErr || !blob) {
      return json({ error: `Could not read screenshot: ${dlErr?.message}` }, 400);
    }

    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    const chunk = 32768;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    const b64 = btoa(binary);
    const ext = path.split(".").pop()?.toLowerCase() ?? "png";
    const mediaType = MEDIA_TYPES[ext] ?? "image/png";

    const anthropic = new Anthropic({
      apiKey: Deno.env.get("ANTHROPIC_API_KEY"),
    });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 2048,
      output_config: {
        format: { type: "json_schema", schema: EXTRACT_SCHEMA },
      },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: b64 },
            },
            {
              type: "text",
              text:
                "This is a screenshot of Spotify for Artists stats for one track. " +
                "Extract the numbers exactly as shown. Streams, listeners, saves and " +
                "playlist adds are integers — expand abbreviations (1.2K = 1200, 1.2M = 1200000). " +
                "The src_* fields are the source-of-streams breakdown (listener's own " +
                "library, external/direct, search, queue/autoplay, algorithmic playlists, " +
                "editorial playlists) — record each as a whole number (round " +
                "percentages to the nearest integer). Use null for anything not visible in the screenshot. Do not " +
                "guess or infer values that are not shown.",
            },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return json({ error: "The model declined to read this image." }, 422);
    }
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return json({ error: "No extraction returned." }, 502);
    }
    const extracted = JSON.parse(textBlock.text);

    const payload = {
      ...extracted,
      captured_on: extracted.captured_on ?? new Date().toISOString().slice(0, 10),
      screenshot_url: path,
      triggered_by_external_id: external_id ?? null,
    };

    const { error: rpcErr } = await supabase.rpc("mx_add_streaming_capture", {
      p_payload: payload,
    });
    if (rpcErr) {
      return json({ error: `Extracted but failed to save: ${rpcErr.message}` }, 500);
    }

    return json({ capture: payload });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
