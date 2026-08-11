import { useEffect, useMemo, useState } from "react";
import { fetchSharePosts, fetchShareSummary } from "../lib/data";
import { age, compact, multiple, shortDate } from "../lib/format";
import type { SharePost, ShareSummary } from "../lib/types";
import { Section, Empty } from "./Section";
import { BrandRow, PlatformTable, Stat, platformLabel } from "./BrandRow";
import EngagementExplainer from "./EngagementExplainer";

const QUARTER_DAYS = 92;
const PAGE_SIZE = 10;
const PAGE_MAX = 50;

/**
 * Public, unauthenticated view of one brand's own figures.
 *
 * Reached at /share/[token] with no session — mx_share_summary and
 * mx_share_posts are granted to anon and scoped to the token's brand.
 * Deliberately a dead end: no nav, no links back into the dashboard, and no
 * paid-support, spend, owner or notes UI (the functions don't return those
 * fields, and nothing here should invent them).
 */
export default function SharePage({ token }: { token: string }) {
  const [posts, setPosts] = useState<SharePost[] | null>(null);
  const [summary, setSummary] = useState<ShareSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [latestVisible, setLatestVisible] = useState(PAGE_SIZE);

  useEffect(() => {
    window.scrollTo(0, 0);
    Promise.all([fetchSharePosts(token), fetchShareSummary(token)])
      .then(([p, s]) => {
        setPosts(p);
        setSummary(s);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [token]);

  // Per-platform medians, keyed for per-row lookup.
  const medianFor = useMemo(() => {
    const m = new Map<string, ShareSummary>();
    for (const s of summary) m.set(`${s.network}|${s.content_type}`, s);
    return m;
  }, [summary]);
  const medEngFor = (p: SharePost) =>
    medianFor.get(`${p.network}|${p.content_type}`)?.median_engagement_rate ??
    null;
  const medCompFor = (p: SharePost) =>
    medianFor.get(`${p.network}|${p.content_type}`)?.median_completion_pct ??
    null;

  const brandName = summary[0]?.brand_name ?? posts?.[0]?.brand_name ?? "";
  const totalPosts = summary.reduce((n, s) => n + s.posts, 0);
  const totalViews = summary.reduce((n, s) => n + s.views, 0);
  const lastPost = summary
    .map((s) => s.last_post)
    .filter(Boolean)
    .sort()
    .pop();

  const recent = useMemo(
    () => (posts ?? []).filter((p) => p.age_days <= QUARTER_DAYS),
    [posts],
  );
  const leading = useMemo(
    () =>
      [...recent]
        .filter((p) => p.views_multiple > 1)
        .sort((a, b) => b.views_multiple - a.views_multiple)
        .slice(0, 10),
    [recent],
  );
  const latest = useMemo(
    () =>
      [...(posts ?? [])].sort(
        (a, b) => +new Date(b.published_at) - +new Date(a.published_at),
      ),
    [posts],
  );
  const mostViewed = useMemo(
    () => [...(posts ?? [])].sort((a, b) => b.views - a.views).slice(0, 10),
    [posts],
  );
  const bestScoring = useMemo(
    () =>
      [...(posts ?? [])]
        .sort((a, b) => b.views_multiple - a.views_multiple)
        .slice(0, 10),
    [posts],
  );
  const bestEngagement = useMemo(
    () =>
      recent
        .filter((p) => (p.engagement_multiple ?? 0) > 1)
        .sort(
          (a, b) => (b.engagement_multiple ?? 0) - (a.engagement_multiple ?? 0),
        )
        .slice(0, 10),
    [recent],
  );
  // Engagement scores are not comparable across platforms — rank within
  // platform + format only, never one mixed list.
  const topEngRateGroups = useMemo(() => {
    const groups = new Map<string, SharePost[]>();
    for (const p of posts ?? []) {
      if (p.engagement_rate === null) continue;
      const key = `${p.network}|${p.content_type}`;
      const arr = groups.get(key) ?? [];
      arr.push(p);
      groups.set(key, arr);
    }
    return [...groups.entries()]
      .map(([key, arr]) => {
        const [network, contentType] = key.split("|");
        return {
          label: platformLabel(network, contentType),
          posts: arr
            .sort((a, b) => (b.engagement_rate ?? 0) - (a.engagement_rate ?? 0))
            .slice(0, 5),
          total: arr.length,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [posts]);
  const reels = useMemo(
    () =>
      (posts ?? []).filter(
        (p) => p.network === "instagram" && p.content_type === "reels",
      ),
    [posts],
  );
  const mostWatched = useMemo(
    () =>
      reels
        .filter((p) => p.completion_pct !== null)
        .sort((a, b) => (b.completion_pct ?? 0) - (a.completion_pct ?? 0))
        .slice(0, 5),
    [reels],
  );

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <p className="text-sm text-accent">{error}</p>
      </div>
    );
  }

  if (posts === null) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <p className="text-sm text-dim">Loading…</p>
      </div>
    );
  }

  // Unknown, revoked or expired token: both functions return zero rows.
  if (posts.length === 0 && summary.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <h1 className="font-serif text-3xl">This link is no longer active</h1>
          <p className="mt-3 text-sm leading-relaxed text-dim">
            It may have been revoked or reached its expiry date. Ask whoever
            sent it for a new one.
          </p>
        </div>
      </div>
    );
  }

  const viewsMeta = (p: SharePost) =>
    `${shortDate(p.published_at)} · ${compact(p.views)} views vs ${compact(p.median_views)} median`;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 sm:px-10">
      <header className="mb-12">
        <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-dim">
          Social performance
        </p>
        <h1 className="mt-1 font-serif text-4xl tracking-tight">{brandName}</h1>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-dim">
          These are {brandName}'s own figures — no other account's data appears
          here. Every post is measured against this account's own typical
          performance, on the same platform and in the same format.
        </p>

        <div className="mt-6 flex flex-wrap gap-x-10 gap-y-4">
          <Stat value={String(totalPosts)} label="Posts" />
          <Stat value={compact(totalViews)} label="Views" />
          {lastPost && (
            <Stat value={shortDate(lastPost)} label="Most recent post" />
          )}
        </div>

        <PlatformTable rows={summary} compact={compact} />

        <p className="mt-4 max-w-prose text-[13px] leading-relaxed text-dim">
          "All time" here means since measurements began — not the account's
          whole life.
        </p>
      </header>

      <div className="space-y-12">
        <Section
          id="share-leading"
          title="Leading posts"
          timescale="last 3 months"
          count={leading.length}
          subtitle="Posts beating this account's typical performance, most recent quarter."
          defaultOpen
        >
          {leading.length === 0 ? (
            <Empty>Nothing above typical this quarter.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {leading.map((p) => (
                <BrandRow
                  key={p.external_id}
                  post={p}
                  headline={multiple(p.views_multiple)}
                  meta={viewsMeta(p)}
                />
              ))}
            </ul>
          )}
        </Section>

        <Section
          id="share-latest"
          title="Latest posts"
          count={latest.length}
          subtitle="Everything published, newest first."
        >
          {latest.length === 0 ? (
            <Empty>Nothing here yet.</Empty>
          ) : (
            <>
              <ul className="divide-y divide-line">
                {latest.slice(0, Math.min(latestVisible, PAGE_MAX)).map((p) => (
                  <BrandRow
                    key={p.external_id}
                    post={p}
                    right={multiple(p.views_multiple)}
                    meta={`${age(p.age_days)} old · ${compact(p.views)} views vs ${compact(p.median_views)} median`}
                  />
                ))}
              </ul>
              {latestVisible < Math.min(latest.length, PAGE_MAX) && (
                <button
                  className="mt-4 text-[13px] text-dim underline underline-offset-2 hover:text-ink"
                  onClick={() =>
                    setLatestVisible((v) => Math.min(v + PAGE_SIZE, PAGE_MAX))
                  }
                >
                  Load more ({Math.min(latest.length, PAGE_MAX) - latestVisible}{" "}
                  more)
                </button>
              )}
            </>
          )}
        </Section>

        <Section
          id="share-most-viewed"
          title="Most viewed"
          timescale="all time"
          count={mostViewed.length}
          subtitle="Raw reach — biggest posts regardless of how normal that is for this account."
        >
          <ul className="divide-y divide-line">
            {mostViewed.map((p) => (
              <BrandRow
                key={p.external_id}
                post={p}
                headline={compact(p.views)}
                meta={`${shortDate(p.published_at)} · ${multiple(p.views_multiple)} its baseline`}
              />
            ))}
          </ul>
        </Section>

        <Section
          id="share-best"
          title="Best scoring"
          timescale="all time"
          count={bestScoring.length}
          subtitle="Furthest above this account's own typical performance."
        >
          <ul className="divide-y divide-line">
            {bestScoring.map((p) => (
              <BrandRow
                key={p.external_id}
                post={p}
                headline={multiple(p.views_multiple)}
                meta={viewsMeta(p)}
              />
            ))}
          </ul>
        </Section>

        <div className="space-y-4 pt-4">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.25em] text-dim">
            Engagement
          </h2>
          <EngagementExplainer />
        </div>

        <Section
          id="share-best-eng"
          title="Best engagement"
          timescale="last 3 months"
          count={bestEngagement.length}
          subtitle="Posts where people did more than watch, relative to this account's norm."
        >
          {bestEngagement.length === 0 ? (
            <Empty>Nothing above the account's norm this quarter.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {bestEngagement.map((p) => {
                const med = medEngFor(p);
                return (
                  <BrandRow
                    key={p.external_id}
                    post={p}
                    headline={multiple(p.engagement_multiple)}
                    meta={`${shortDate(p.published_at)} · ${platformLabel(p.network, p.content_type)} · ${p.engagement_rate?.toFixed(1)} per 100 views${med !== null ? ` vs ${med.toFixed(1)} median` : ""}`}
                  />
                );
              })}
            </ul>
          )}
        </Section>

        <Section
          id="share-top-eng"
          title="Top engagement rate"
          timescale="all time, per platform"
          count={topEngRateGroups.reduce((n, g) => n + g.posts.length, 0)}
          subtitle="Highest weighted engagement per 100 views. Ranked within each platform and format — the score isn't comparable across them."
        >
          {topEngRateGroups.length === 0 ? (
            <Empty>No engagement data yet.</Empty>
          ) : (
            <div className="space-y-6">
              {topEngRateGroups.map((g) => (
                <div key={g.label}>
                  <h4 className="pt-4 text-[11px] font-medium uppercase tracking-[0.15em] text-dim">
                    {g.label}
                  </h4>
                  <ul className="divide-y divide-line">
                    {g.posts.map((p) => {
                      const med = medEngFor(p);
                      return (
                        <BrandRow
                          key={p.external_id}
                          post={p}
                          headline={p.engagement_rate?.toFixed(1) ?? "—"}
                          meta={`${shortDate(p.published_at)} · ${compact(p.views)} views${med !== null ? ` · median ${med.toFixed(1)}` : ""}`}
                        />
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section
          id="share-watched"
          title="Most watched through"
          timescale="Instagram reels only"
          count={mostWatched.length}
          subtitle={`Average watch time as a share of video length. Only Instagram reels report watch time. TikTok doesn't expose it, and Metricool doesn't return video length for every reel — so this covers a subset even within Instagram.${reels.length > 0 ? ` From ${reels.filter((p) => p.completion_pct !== null).length} of ${reels.length} reels.` : ""}`}
        >
          {mostWatched.length === 0 ? (
            <Empty>No video duration data for this account.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {mostWatched.map((p) => {
                const med = medCompFor(p);
                return (
                  <BrandRow
                    key={p.external_id}
                    post={p}
                    headline={`${Math.round(p.completion_pct ?? 0)}%`}
                    meta={`${shortDate(p.published_at)} · ${compact(p.views)} views${med !== null ? ` · account median ${Math.round(med)}%` : ""}`}
                  />
                );
              })}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}
