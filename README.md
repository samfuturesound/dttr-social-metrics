# DTTR Social Metrics

Internal morning glance page for the social accounts Future Sound looks after
— Dance to the Radio, Eject Records and whatever is added next. Answers one
question: **what's performing unusually well and needs a reaction today.**

Deployed at `dttrmetrics.futuresoundartistservices.com` (Vercel). Reads the
`mx_*` views in its own Supabase project `pvyyaiaaqikvilukcqva`. It used to
share a project with SongFlux and the co-publishing calculator; it was split
out onto its own in August 2026.

The schema lives in `supabase/migrations/` — extracted from the database during
that split, and the source of truth since. See
[supabase/migrations/README.md](supabase/migrations/README.md) for what each
migration does and, more importantly, which three performance changes look
removable and are not.

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

- Set the password with the `MX_SHARED_PASSWORD` edge function secret — no
  redeploy needed to change it later. **The secret is required.** If it is
  unset or blank, `mx-login` fails closed: it returns 503 and accepts no
  password at all, including the one you are thinking of.
  There is deliberately no default. An earlier version fell back to a literal
  that was printed here, which meant a deploy that had never been given the
  secret looked exactly like a working one — and the password was public.
  `src/__tests__/mx-login-fails-closed.test.ts` asserts it cannot come back.
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

## Labels

Labels are many-to-many: `mx_brands.labels` is a text array and every post
view carries the same `labels` column. Brands appear on the main dashboard
regardless of label — labels slice the roster, they don't partition it.

- Toggle from the Brands panel (a checkbox per label per brand, calling
  `mx_set_brand_label`); create with `mx_add_label`.
- `/label/[slug]` is the internal label view: each brand's per-platform
  medians *with* roster ranks, then the usual post and engagement sections.
- `/share/label/[token]` is the public equivalent — see below.

### The label selector, and why All is not a label

The board carries a page-level selector: **All**, then one option per label in
`mx_labels`, in name order. It narrows every section below it — Leading,
Latest, Best, Most viewed, the leaderboard and the trend chart — client-side
on the `labels` column the views already return, so a selection costs no round
trip. It sits beside the platform filter and the two are independent: a label
narrows which accounts, a platform narrows which of their posts.

**All is a scope of its own, not a label.** Until the label data was fixed
"Dance to the Radio" carried every brand on the roster, so filtering to that
label and showing everything were the same page and nothing had to tell them
apart. They are now different — Dance to the Radio carries its own nine active
artists — so [`LabelScope`](src/lib/labels.ts) models the two as different
shapes. An All scope holds no label, which is what stops any code path
reaching a label's name, slug or share token from it: `scopeLabel` returns
null and every caller has to handle that. A held scope is also re-resolved
against each `mx_labels` fetch, and a label that has been deleted falls back
to All rather than to a neighbouring label.

The options are data. Nothing in `lib/labels.ts` or `LabelFilter.tsx` names a
label — [a test asserts that](src/__tests__/label-scope.test.ts) — so a label
created in the Brands panel appears on the next load with no code change,
**including one with no brands yet**. Selecting an empty label shows one plain
statement ("No brands assigned to this label yet"), not ten empty sections and
not an error: Slam Dunk Records is in that state today, and a new label would
look broken if it were hidden until someone tagged a brand.

One figure on the board cannot follow the selector. `mx_skip_roster` is a
single whole-roster skip median with no brand or label column to slice, so it
is marked **All labels** in place, the same treatment and for the same reasons
as the platform rollups below. Everything else on the board — including the
leaderboard and the two tiles fed by `mx_account_scores` — does carry `labels`
and does follow it.

The selector is internal-only, and so is the brand/label page it links to. The
share RPCs return no label column at all, so a selector on a share route would
have nothing to filter on even if it belonged there; a label share link is
already scoped to one label by its token. `share-assist-isolation.test.tsx`
asserts no share page imports it.

### What a label share link actually covers

`mx_label_share_summary` and `mx_label_share_posts` match on label membership
alone, with no `active` filter, so a label share covers **every brand carrying
the label that has data** — not just the active ones. For Dance to the Radio
today that is 11 accounts: the 9 active artists plus Lofi Bloom and Nature,
two inactive theme accounts that still have posts on file. The label page's
Brands tile counts all 15 tagged brands and its Artists tile counts 9, so the
three numbers are each correct about different things.

`mx_label_share_posts` reads `post_detail_mv`, which is refreshed by
`mx_refresh_derived()` on a 03:30 cron. **A label change is not visible on a
share route until that refresh**: between the two, a share link lists posts
under the labels the brands used to carry.

## Public share links

`/share/[token]` (one brand) and `/share/label/[token]` (a whole label) render
with no sign-in. Both routes sit ahead of the auth gate in
[App.tsx](src/App.tsx) and use anon-granted RPCs scoped to their token. An
unknown, revoked or expired token returns zero rows, shown as "This link is no
longer active".

Share views omit paid support, spend, owner, notes **and roster ranks**, and
carry no nav or links back into the dashboard. Each public page is a separate
component from its internal counterpart rather than one behind a flag
(`SharePage`/`BrandPage`, `LabelSharePage`/`LabelPage`,
`PlatformTable`/`RankedPlatformTable`) so a stray prop can't leak internal
figures. The share functions return no such columns either.

Create, label, expire and revoke links from the Share control on the internal
brand or label page; revocation takes effect on the next request.

## AI Summarise

`/ask` (internal only — it sits after the auth gate and no share route can
reach it). A brand + period selector, a question box, and prose back.

The `mx-ai-summarise` edge function
([supabase/functions/mx-ai-summarise](supabase/functions/mx-ai-summarise/index.ts))
loads `mx_ai_context(brand, days)`, sends it to Claude Sonnet with the
question, and logs the exchange via `mx_log_ai_query`. Both RPCs have had
EXECUTE **revoked from PUBLIC** — they shipped reachable by any authenticated
user of the shared project, which would have exposed the whole roster through
PostgREST. The function is now their only caller, using the service-role key
after checking the caller is the internal service account.

The context payload is sent as a cached system block, so repeat questions on
the same brand and period re-read it at cache rates. Payload sizes: one brand
≈ 8k tokens, all brands over 12 months ≈ 61k.

Requires the `ANTHROPIC_API_KEY` secret (shared with the vision function).

## Platform filter

Every internal page — dashboard, `/brand/[name]`, `/label/[slug]` — carries a
page-level platform control: **All / TikTok / Instagram posts / Instagram
reels**, defaulting to All. It narrows every section below it (Leading, Latest,
Best, Most viewed, the platform tables and the trend chart) by slicing data
already fetched; no view, RPC or round trip changes. The vocabulary lives in
[src/lib/platforms.ts](src/lib/platforms.ts) and the control in
[src/components/PlatformFilter.tsx](src/components/PlatformFilter.tsx).

When a platform is selected the trend chart's own platform tabs disappear and
the chart follows the page — two controls for one choice, with one of them
silently losing, is worse than either alone. Under **All** the chart keeps its
tabs, because it can never pool platforms even when the rest of the page shows
everything.

**Three figures cannot honour it, and say so rather than lying.**
`mx_brand_summary` (the brand page header), `mx_account_scores` (the dashboard
leaderboard and its Views / Accounts tiles) and `mx_labels` (the label page's
brand counts) are brand-level rollups with no platform column — nothing
client-side can narrow them. Those figures stay on screen, greyed, labelled
*all platforms*. They are not hidden: a number that vanishes teaches nothing
about why, and hiding would empty a brand page's whole header exactly when
someone is comparing platforms. Anything fed by those three sources must render
through `RollupStat` or `RollupNote`.

**The filter is internal-only.** Share routes get no page control:
`src/__tests__/share-assist-isolation.test.tsx` asserts neither share page
imports it, passes `platformKey` to the chart, or carries the *all platforms*
marker — the same structural guard that keeps the paid-marking control off
those pages.

## Monthly trend, and months that are still settling

The chart plots the last **six ended months**. It used to require a month to be
30 days past its end, which hid the two most recent months — on 6 November the
newest point was September, with 206 October posts already collected and
invisible.

A month whose end is less than 30 days ago arrives flagged `is_provisional`:
its youngest posts are still accruing views, so its median will drift upward.
Those points, and the segments leading into them, are **dashed**; the axis
label and the Table view say *settling*; the tooltip says so in words; and one
line under the chart names the month. An unmarked provisional point reads as a
decline that is not there, which is the whole reason the strict rule existed —
see `supabase/migrations/README.md`.

A series with a single month is drawn as a deliberate, larger marker with a
legend entry rather than a bare 4px dot, which read as a rendering failure.

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
