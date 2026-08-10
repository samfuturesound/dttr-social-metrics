# DTTR Social Metrics

Internal morning glance page for Dance to the Radio's social accounts. Answers
one question: **what's performing unusually well and needs a reaction today.**

Deployed at `dttrsocialmetrics.songflux.app` (Vercel). Reads the `mx_*` views
in the shared Supabase project `okcaidesyifrbjwdfeyo` — see
`SCHEMA-REFERENCE.md` context in the database itself; the schema is managed
there, not in this repo.

## Stack

Vite + React 18 + TypeScript + Tailwind v4. Supabase JS for auth, data,
storage and the `mx-spotify-vision` edge function (in
[supabase/functions/mx-spotify-vision](supabase/functions/mx-spotify-vision/index.ts)).

## Run locally

```bash
bun install
bun run dev
```

`.env` (see `.env.example`):

- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` — the shared project.
- `VITE_ALLOWED_EMAILS` — comma-separated emails allowed past the login gate.
- `VITE_MOCK=1` — render fixture data with no auth (UI development only).

Sign-in uses existing Supabase accounts (email + password) — there is no
sign-up flow, deliberately.

## Data notes

- Flagged posts come from `mx_flagged_interim` (median-based, works on
  backfilled data). Switch to `mx_flagged` in
  [src/lib/data.ts](src/lib/data.ts) once ~4 weeks of daily snapshots exist.
- `avg_watch_seconds` is not on the interim view — it's joined from
  `mx_snapshots` for flagged reels.
- Assisted posts (boosted/clipped) keep their multiple but de-emphasised —
  after the assist date the numbers reflect spend, not content.

## Spotify screenshot flow

Upload on a flagged post → private `mx-streaming` storage bucket →
`mx-spotify-vision` edge function → Anthropic API vision extraction
(structured output) → `mx_add_streaming_capture` RPC. The function runs under
the caller's JWT, so storage policies and RPC grants apply as normal.

Supabase secrets the function needs:

- `ANTHROPIC_API_KEY` — **must be set before the upload flow works.**
- `MX_ALLOWED_EMAILS` — optional server-side allowlist (defence in depth; the
  frontend allowlist alone is cosmetic).

## Deploy (Vercel)

Standard Vite build (`bun run build`, output `dist/`). `vercel.json` adds
`X-Robots-Tag: noindex` on every route and the SPA rewrite; `index.html` also
carries a `noindex` meta tag. No sitemap. Set the three `VITE_*` env vars in
Vercel project settings.
