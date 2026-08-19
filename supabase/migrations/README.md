# Migrations

The schema for this app, extracted from the database on 19 Aug 2026 when it was
split out of the shared Supabase project onto its own (`pvyyaiaaqikvilukcqva`).

Until then the repo carried no migrations at all — the live database was the
only record of the schema. These files were written out of
`supabase_migrations.schema_migrations` on the new project rather than typed by
hand, so they reproduce it exactly.

Applied in filename order they build the whole schema from an empty project:

| File | What it creates |
|---|---|
| `…111000_metrics_schema_tables` | 13 `metrics` tables, constraints, indexes |
| `…111029_metrics_views_l0_l1` | base views (`snapshots`, `period`, `labels`, …) |
| `…111124_metrics_views_l2` | `scored_posts`, `post_baselines`, `movers`, … |
| `…111219_metrics_views_l3` | `post_engagement`, `alerts`, `leading_posts`, … |
| `…111308_metrics_views_l4_l6` | `post_detail`, `brand_platform_summary`, ranks |
| `…112135_mx_api_layer_functions` | 29 `public.mx_*` functions |
| `…112309_mx_email_payload_builders` | `mx_alert_payload`, `mx_digest_payload` |
| `…112349_mx_api_layer_views_and_grants` | 28 `public.mx_*` views + all grants |
| `…112419_mx_harden_security_invoker_and_rls` | `security_invoker`, RLS, policies |
| `…113053_mx_add_missing_digest_functions` | `mx_is_digest_week`, `mx_digest_claim` |
| `…113105_mx_digest_function_grants` | grants for the two above |
| `…113445_mx_digest_claim_lock_to_service_role` | narrows `mx_digest_claim` |
| `…113519_mx_streaming_storage_bucket` | `mx-streaming` bucket + 2 policies |
| `…125511_mx_rls_policies_initplan_optimisation` | rewrites the `mx_internal_read` policies |
| `…125835_raw_snapshots_distinct_on_support_index` | index for the `DISTINCT ON` sort |
| `…130153_authenticated_statement_timeout_20s` | raises the statement timeout to 20s |
| `…141004_post_detail_materialized_view` | `metrics.post_detail_mv` + its indexes |
| `…141027_brand_platform_summary_use_mv` | repoints `brand_platform_summary` at the MV |
| `…141041_share_functions_use_mv_and_refresh_rpc` | share functions read the MV; `mx_refresh_derived()` |
| `…141226_schedule_derived_refresh_pg_cron` | schedules the nightly refresh |
| `…142307_post_engagement_drop_redundant_extras_cte` | removes the duplicated `DISTINCT ON` |

The view files must run in order — the views form a dependency chain six levels
deep, from `raw_snapshots` up to `brand_platform_ranks`.

## Three performance changes that look like noise and are not

These are load-bearing. Each was added to fix a measured problem, and each looks
like something a tidy-up would remove.

**The RLS policies say `using ((select public.mx_is_internal()))`. The subselect
is doing work — do not "simplify" it to `using (public.mx_is_internal())`.**
Written bare, the guard is a volatile-looking function call in the row filter and
Postgres re-evaluates it for every row scanned. Wrapped in a scalar subquery it
becomes an InitPlan, evaluated once per query. On `mx_post_detail` that is the
difference between **14.3s and 1.4s** — a tenfold gap that gets worse as
`raw_snapshots` grows. `…125511` rewrites whatever `mx_internal_read` policies
exist when it runs, so it must come after
`…112419_mx_harden_security_invoker_and_rls` has created them.

**`raw_snapshots_latest_per_post_idx` exists to serve one `DISTINCT ON`.**
`metrics.post_engagement` does `DISTINCT ON (brand_id, network, content_type,
external_id) … ORDER BY … captured_on DESC` to pick the latest snapshot per post.
That needs the sort column in descending order. The unique constraint
`raw_snapshots_brand_id_network_content_type_external_id_cap_key` covers the same
leading columns but with `captured_on` **ASC**, and cannot serve the sort — so
without this index the planner falls back to a full sort. Adding it on its own
took the dashboard from **6.7s to 1.4s**. It duplicates the constraint's columns
on purpose; that is not redundancy.

**`statement_timeout` is 20s for `authenticated`, against Supabase's 8s
default.** This project runs on Micro compute, and the heavier views sit close
enough to 8s that the default trips them under load. Set at the role level via
`alter role authenticated set statement_timeout`, so it is not visible in the
schema and will not survive a rebuild unless `…130153` is applied. It was
originally run as a direct statement with no history row; that is why the
migration exists.

## `post_detail_mv`, and the one way it fails

`metrics.post_detail_mv` is materialized rather than a plain view because
`brand_platform_summary` previously joined `post_detail` on `brand_name` — a
text column. That blocked predicate pushdown: filtering by one brand could not
be pushed down into the view stack, so every anonymous share link computed all
12 brands before discarding 11 of them. **4.7s, against the 3s
`statement_timeout` the `anon` role carries — so public share links timed out
rather than merely being slow.** The MV carries `brand_id` and is indexed on it,
so a share link now filters on an integer key.

**It is refreshed by the pg_cron job `mx-refresh-derived` at 03:30 daily, thirty
minutes after FS-6.** The refresh is `REFRESH MATERIALIZED VIEW CONCURRENTLY`,
which is why `post_detail_mv_key` is a unique index — concurrent refresh
requires one.

**If that job stops, share links silently serve stale data rather than
failing.** There is no staleness check and nothing surfaces the last refresh
time to a viewer. A share page will keep rendering yesterday's, or last month's,
figures perfectly happily. When diagnosing "the numbers look wrong on a share
link", check `cron.job_run_details` for `mx-refresh-derived` before looking
anywhere else.

## The `extras` CTE, and symptom versus cause

`metrics.post_engagement` used to carry an `extras` CTE: a `DISTINCT ON` over
`snapshots_aged` to pick the latest snapshot per post, joined back on
`(external_id, network, content_type)` purely to fetch `follows`, `reach` and
`duration_seconds`.

It duplicated work `scored_posts` had already done. `scored_posts`' `latest` CTE
performs the identical `DISTINCT ON` and already selects those three columns —
it simply did not project them. Worse, the planner did not hoist `extras` out of
the join: it re-executed it **once per `scored_posts` row — 596 loops** over all
of `raw_snapshots`, **2,897,752 of 2,903,711 buffers, 99.8% of the query's total
cost**. `extras` also emitted 616 stories rows that could never match, since
`scored_posts` excludes stories.

The fix projects the three columns from `scored_posts` and deletes the CTE and
its join, making it a single pass. Verified equivalent before and after against
the live database: identical md5 over the full ordered output of
`post_engagement`, identical row counts for `mx_post_detail`,
`mx_brand_platform_summary`, `mx_best`, `mx_leading` and `mx_flagged`. The
migration carries that check inline as a `DO` block that raises on any
difference, so a replay that is not equivalent aborts rather than half-applying.

**This is the cause; the two changes before it addressed the symptom.** The
`brand_name` text join and `post_detail_mv` stopped anonymous share links from
computing all 12 brands, which is what made the timeout visible. But the
per-row re-scan underneath was still there, still being paid — by the nightly
`REFRESH`, and by every internal dashboard page, which reads `post_detail`
rather than the MV. Removing `extras` removes it from all three paths.

Measured after the change, against the live database:

| Query | Before | After |
|---|---|---|
| `mx_share_summary` as `anon` | 4,680ms / 2,905,325 buffers | **7.6ms / 1,086 buffers** |
| `mx_share_posts` as `anon` | 1,780ms | **3.1ms / 463 buffers** |
| `mx_post_detail` as `authenticated` | — | **751ms / 5,870 buffers** |

## Three history rows with no file here

The remote history table on the new project also lists
`20260819103457_metrics_schema_base_tables`,
`20260819103553_metrics_views_level_0_1` and
`20260819103645_metrics_views_level_2`. They were an earlier partial attempt,
undone by a `drop schema metrics cascade` reset before the migrations above ran.
Their objects do not exist, and their `CREATE TABLE` statements would collide
with `…111000_metrics_schema_tables`, so they are deliberately not committed.
Expect `supabase migration list` to show them as remote-only.

## These files carry no data

Schema only. The row data was copied separately, server to server. If you
rebuild from empty you get the structure and no rows — `metrics.raw_snapshots`
is the table everything else derives from, so until it is populated every
post-derived view reads zero.

## Two deliberate differences from the old shared project

**Grants.** On the shared project, `EXECUTE` on eight write RPCs
(`mx_add_label`, `mx_create_share`, `mx_create_label_share`, `mx_list_shares`,
`mx_list_label_shares`, `mx_revoke_share`, `mx_revoke_label_share`,
`mx_set_brand_label`) was reachable by `anon` through a `PUBLIC` grant. They
were safe only because each calls `mx_assert_internal()` internally. That is not
reproduced: `PUBLIC` is revoked and every role is granted explicitly. Only the
six token-scoped share readers plus the two guard helpers are anon-callable.

**`security_invoker`.** Every `public.mx_*` view sets it. These views are thin
projections over the `metrics` schema, and the RLS that actually protects the
data sits on the `metrics` base tables — without `security_invoker` the views
run as owner and bypass it completely. On the old project two views
(`mx_brand_skip_rates`, `mx_skip_roster`) were missing it.

## Identity

`mx_is_internal()` matches on the JWT email claim
(`mx-internal@dttrsocialmetrics.app`), not on a uid.

The service account's uid on this project is
`1dddbd76-b24f-41a2-a7f8-ccf2df1e40e3`. It differs from the uid it had on the old
shared project, and that is fine and settled: the match is by email, and nothing
in the `metrics` schema references a uid — there are no `uuid` columns anywhere
in it. There is no need to carry the old uid across, and no need to pin the
function to a hard-coded one. If anyone ever does pin it, it must be the uid
above, not the old project's.
