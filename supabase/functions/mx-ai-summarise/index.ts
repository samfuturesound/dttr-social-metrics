// mx-ai-summarise — answer a question about the roster's Metricool data.
//
// Fetches mx_ai_context(brand, days), sends it to Claude with the question,
// returns prose, and logs the exchange via mx_log_ai_query.
//
// Auth: verify_jwt is on, and the caller must additionally be the internal
// service account — the same boundary mx_assert_internal() enforces on the
// write RPCs. Both AI RPCs have had EXECUTE revoked from PUBLIC, so this
// function is their only caller and reaches them with the service-role key.
//
// Secrets: ANTHROPIC_API_KEY.

import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";

const SERVICE_EMAIL = "mx-internal@dttrsocialmetrics.app";
const MAX_QUESTION = 2000;

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

const SYSTEM_PROMPT = `You are an analyst for Dance to the Radio, an independent record label. You answer questions about the social performance of the label's accounts using only the JSON data supplied with each question.

How to answer:

Quote the specific figures you are reasoning from, so the reader can check them against the tables in the app. Name the post, the date, and the numbers. An answer with no figures in it is not useful.

Say plainly when the data does not support an answer. If there are too few posts, if the metric is missing on that platform, or if the question is about something the data cannot show, say so and stop. Do not guess, extrapolate, or fill the gap with plausible-sounding generalities. "The data doesn't show this" is a good answer when it is the true one.

Never compare engagement rates across platforms as if they were equivalent. TikTok reports only views, likes, comments and shares; Instagram adds saves and follows, which carry the heaviest weights in the engagement score, and reels alone report watch time and skip rate. A TikTok post therefore has fewer ways to score and will always look weaker on raw engagement rate. Compare within one platform and format, or explicitly note that you are not comparing like with like.

Treat the views multiple as a measure of unusualness, not quality. A multiple of 3 means three times the median views of that account on that platform in that format — it says the post was unusual for that account, not that it was good, and not that it out-reached a bigger account's ordinary day. A high multiple on a small account can still mean fewer people saw it.

Other things worth knowing: skip rate is the share of viewers who scrolled past in the first three seconds, so lower is better, and it measures the hook alone. Watch-through and skip rate exist on Instagram reels only. Posts marked assisted were paid for and their numbers reflect spend rather than the content.

Write in plain prose, in British English. Be concise and specific. Use short paragraphs; use a short list only when genuinely enumerating. Do not use headers, and do not open with a restatement of the question.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  let question = "";
  let brand: string | null = null;

  try {
    const body = await req.json();
    question = String(body.question ?? "").trim();
    brand = body.brand ? String(body.brand) : null;
    const days = Number(body.days ?? 90);

    if (!question) return json({ error: "Ask a question first." }, 400);
    if (question.length > MAX_QUESTION) {
      return json({ error: "That question is too long." }, 400);
    }
    if (![30, 90, 365].includes(days)) {
      return json({ error: "Unsupported period." }, 400);
    }

    // Caller must be the internal service account.
    const asCaller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: {
        headers: { Authorization: req.headers.get("Authorization") ?? "" },
      },
    });
    const { data: userData, error: userErr } = await asCaller.auth.getUser();
    if (userErr || !userData.user) {
      return json({ error: "Not authenticated" }, 401);
    }
    if (userData.user.email?.toLowerCase() !== SERVICE_EMAIL) {
      return json({ error: "Not authorized" }, 403);
    }

    // The AI RPCs are service-role only.
    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false },
    });

    const { data: context, error: ctxErr } = await admin.rpc("mx_ai_context", {
      p_brand: brand,
      p_days: days,
    });
    if (ctxErr) return json({ error: `Could not load data: ${ctxErr.message}` }, 500);

    const postCount = Array.isArray(context?.posts) ? context.posts.length : 0;
    if (postCount === 0) {
      return json({
        answer:
          "There are no posts in that window for that selection, so there's nothing to analyse. Try a longer period, or a different account.",
        posts: 0,
      });
    }

    const anthropic = new Anthropic({
      apiKey: Deno.env.get("ANTHROPIC_API_KEY"),
    });

    const scope = brand ? brand : "all brands";
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 8192,
      system: [
        { type: "text", text: SYSTEM_PROMPT },
        {
          // The payload is identical for repeat questions on the same
          // selection, so cache it — the question itself stays uncached.
          type: "text",
          text:
            `Data for ${scope}, last ${days} days ` +
            `(${postCount} posts):\n\n${JSON.stringify(context)}`,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: question }],
    });

    if (response.stop_reason === "refusal") {
      const msg = "The model declined to answer that question.";
      await admin.rpc("mx_log_ai_query", {
        p_question: question, p_brand: brand, p_answer: null,
        p_tokens_in: null, p_tokens_out: null, p_error: "refusal",
      });
      return json({ error: msg }, 422);
    }

    const answer = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("\n")
      .trim();

    const tokensIn =
      (response.usage.input_tokens ?? 0) +
      (response.usage.cache_read_input_tokens ?? 0) +
      (response.usage.cache_creation_input_tokens ?? 0);

    await admin.rpc("mx_log_ai_query", {
      p_question: question,
      p_brand: brand,
      p_answer: answer,
      p_tokens_in: tokensIn,
      p_tokens_out: response.usage.output_tokens ?? 0,
      p_error: null,
    });

    return json({
      answer,
      posts: postCount,
      tokens_in: tokensIn,
      tokens_out: response.usage.output_tokens ?? 0,
      truncated: response.stop_reason === "max_tokens",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    try {
      const admin = createClient(url, serviceKey, {
        auth: { persistSession: false },
      });
      await admin.rpc("mx_log_ai_query", {
        p_question: question, p_brand: brand, p_answer: null,
        p_tokens_in: null, p_tokens_out: null, p_error: message,
      });
    } catch { /* logging is best-effort */ }
    return json({ error: message }, 500);
  }
});
