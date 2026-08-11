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
- `VITE_MOCK=1` — render fixture data with no auth (UI development only).

## Access

One shared password, checked server-side by the `mx-login` edge function
([supabase/functions/mx-login](supabase/functions/mx-login/index.ts)). On
success it returns a real Supabase session for the internal service account
(`mx-internal@dttrsocialmetrics.app`), which the function creates and
maintains itself. The session persists per browser.

- Change the password by setting the `MX_SHARED_PASSWORD` edge function
  secret — no redeploy needed. Until the secret is set, the fallback is
  `DTTR` (baked into the function, so set the secret).
- All `mx_*` views, write RPCs and the `mx-streaming` bucket are restricted
  to the internal account via RLS + guards (`mx_is_internal()` /
  `mx_assert_internal()` in the database). Other authenticated users of the
  shared project get zero rows; the anon key alone gets permission denied.

## Brand pages

`/brand/[name]` (tiny in-house router — the SPA rewrite in vercel.json makes
deep links work). Header figures from `mx_brand_summary`; sections from
`mx_post_detail`, including the weighted-engagement views (like 1, comment 3,
save 5, share 5, follow 10, per 100 views). Design rule for these pages: never
threshold or scale against roster-wide numbers — every figure sits next to the
account's own median, because the roster spans two orders of magnitude in
reach.

## Public share links

`/share/[token]` renders one brand's figures with no sign-in — the route sits
ahead of the auth gate in [App.tsx](src/App.tsx), and `mx_share_summary` /
`mx_share_posts` are granted to `anon` and scoped to the token's brand. An
unknown, revoked or expired token returns zero rows, which the page shows as
"This link is no longer active".

The share view deliberately omits paid support, spend, owner and notes (the
functions don't return them), and carries no nav or links back into the
dashboard — it's a dead end by design. Create, label, expire and revoke links
from the Share control on the internal brand page; revocation takes effect on
the next request.

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

Only the internal service account may call it.

## Deploy (Vercel)

Standard Vite build (`bun run build`, output `dist/`). `vercel.json` adds
`X-Robots-Tag: noindex` on every route and the SPA rewrite; `index.html` also
carries a `noindex` meta tag. No sitemap. Set `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` in Vercel project settings.
