import { useEffect, useMemo, useState } from "react";
import {
  fetchLabelShareName,
  fetchLabelSharePosts,
  fetchLabelShareSummary,
} from "../lib/data";
import { age, compact, multiple, shortDate } from "../lib/format";
import type { LabelShareSummary, SharePost } from "../lib/types";
import { Section, Empty } from "./Section";
import { BrandRow, PlatformTable, Stat, platformLabel } from "./BrandRow";
import EngagementExplainer from "./EngagementExplainer";

const QUARTER_DAYS = 92;
const PAGE_SIZE = 10;
const PAGE_MAX = 50;

/**
 * Public, unauthenticated view of one LABEL's brands — /share/label/[token].
 *
 * A separate component from LabelPage on purpose, not one component behind a
 * flag: this view must never carry roster ranks, assist flags, spend, owner
 * or notes, and a shared component is one wrong prop away from leaking them.
 * The data can't leak either — mx_label_share_summary and
 * mx_label_share_posts return none of those columns.
 */
export default function LabelSharePage({ token }: { token: string }) {
  const [posts, setPosts] = useState<SharePost[] | null>(null);
  const [summary, setSummary] = useState<LabelShareSummary[]>([]);
  const [labelName, setLabelName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [latestVisible, setLatestVisible] = useState(PAGE_SIZE);

  useEffect(() => {
    window.scrollTo(0, 0);
    Promise.all([
      fetchLabelSharePosts(token),
      fetchLabelShareSummary(token),
      fetchLabelShareName(token),
    ])
      .then(([p, s, n]) => {
        setPosts(p);
        setSummary(s);
        setLabelName(n);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [token]);

  // Medians per brand + platform, for per-row comparison.
  const medianFor = useMemo(() => {
    const m = new Map<string, LabelShareSummary>();
    for (const s of summary)
      m.set(`${s.brand_name}|${s.network}|${s.content_type}`, s);
    return m;
  }, [summary]);
  const medEngFor = (p: SharePost) =>
    medianFor.get(`${p.brand_name}|${p.network}|${p.content_type}`)
      ?.median_engagement_rate ?? null;
  const medCompFor = (p: SharePost) =>
    medianFor.get(`${p.brand_name}|${p.network}|${p.content_type}`)
      ?.median_completion_pct ?? null;

  const byBrand = useMemo(() => {
    const m = new Map<string, LabelShareSummary[]>();
    for (const s of summary) {
      const arr = m.get(s.brand_name) ?? [];
      arr.push(s);
      m.set(s.brand_name, arr);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [summary]);

  const totalPosts = summary.reduce((n, s) => n + s.posts, 0);
  const totalViews = summary.reduce((n, s) => n + s.views, 0);

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

  // Unknown, revoked or expired token: every function returns nothing.
  if (posts.length === 0 && summary.length === 0 && !labelName) {
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

  const meta = (p: SharePost, tail: string) => `${p.brand_name} · ${tail}`;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 sm:px-10">
      <header className="mb-12">
        <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-dim">
          Social performance
        </p>
        <h1 className="mt-1 font-serif text-4xl tracking-tight">
          {labelName ?? "Label"}
        </h1>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-dim">
          These are the figures for {labelName ?? "this label"}'s accounts.
          Every post is measured against its own account's typical performance,
          on the same platform and in the same format.
        </p>

        <div className="mt-6 flex flex-wrap gap-x-10 gap-y-4">
          <Stat value={String(byBrand.length)} label="Brands" />
          <Stat value={String(totalPosts)} label="Posts" />
          <Stat value={compact(totalViews)} label="Views" />
        </div>

        {byBrand.length > 0 && (
          <div className="mt-8 space-y-8">
            {byBrand.map(([brand, rows]) => (
              <div key={brand}>
                <h2 className="font-serif text-xl">{brand}</h2>
                <PlatformTable rows={rows} compact={compact} />
              </div>
            ))}
          </div>
        )}

        <p className="mt-6 max-w-prose text-[13px] leading-relaxed text-dim">
          "All time" here means since measurements began — not the accounts'
          whole life.
        </p>
      </header>

      {posts.length === 0 ? (
        <p className="py-16 text-center text-sm text-dim">
          No posts recorded for these accounts yet.
        </p>
      ) : (
        <div className="space-y-12">
          <Section
            id={`labelshare-leading-${token}`}
            title="Leading posts"
            timescale="last 3 months"
            count={leading.length}
            subtitle="Posts beating their own account's typical performance, most recent quarter."
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
                    meta={meta(
                      p,
                      `${shortDate(p.published_at)} · ${compact(p.views)} views vs ${compact(p.median_views)} median`,
                    )}
                  />
                ))}
              </ul>
            )}
          </Section>

          <Section
            id={`labelshare-latest-${token}`}
            title="Latest posts"
            count={latest.length}
            subtitle="Everything published, newest first."
          >
            <ul className="divide-y divide-line">
              {latest.slice(0, Math.min(latestVisible, PAGE_MAX)).map((p) => (
                <BrandRow
                  key={p.external_id}
                  post={p}
                  right={multiple(p.views_multiple)}
                  meta={meta(
                    p,
                    `${age(p.age_days)} old · ${compact(p.views)} views vs ${compact(p.median_views)} median`,
                  )}
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
          </Section>

          <Section
            id={`labelshare-most-viewed-${token}`}
            title="Most viewed"
            timescale="all time"
            count={mostViewed.length}
            subtitle="Raw reach — biggest posts regardless of how normal that is for the account."
          >
            <ul className="divide-y divide-line">
              {mostViewed.map((p) => (
                <BrandRow
                  key={p.external_id}
                  post={p}
                  headline={compact(p.views)}
                  meta={meta(
                    p,
                    `${shortDate(p.published_at)} · ${multiple(p.views_multiple)} its baseline`,
                  )}
                />
              ))}
            </ul>
          </Section>

          <Section
            id={`labelshare-best-${token}`}
            title="Best scoring"
            timescale="all time"
            count={bestScoring.length}
            subtitle="Furthest above the account's own typical performance."
          >
            <ul className="divide-y divide-line">
              {bestScoring.map((p) => (
                <BrandRow
                  key={p.external_id}
                  post={p}
                  headline={multiple(p.views_multiple)}
                  meta={meta(
                    p,
                    `${shortDate(p.published_at)} · ${compact(p.views)} views vs ${compact(p.median_views)} median`,
                  )}
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
            id={`labelshare-best-eng-${token}`}
            title="Best engagement"
            timescale="last 3 months"
            count={bestEngagement.length}
            subtitle="Posts where people did more than watch, relative to the account's norm."
          >
            {bestEngagement.length === 0 ? (
              <Empty>Nothing above the norm this quarter.</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {bestEngagement.map((p) => {
                  const med = medEngFor(p);
                  return (
                    <BrandRow
                      key={p.external_id}
                      post={p}
                      headline={multiple(p.engagement_multiple)}
                      meta={meta(
                        p,
                        `${platformLabel(p.network, p.content_type)} · ${p.engagement_rate?.toFixed(1)} per 100 views${med !== null ? ` vs ${med.toFixed(1)} median` : ""}`,
                      )}
                    />
                  );
                })}
              </ul>
            )}
          </Section>

          <Section
            id={`labelshare-top-eng-${token}`}
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
                            meta={meta(
                              p,
                              `${compact(p.views)} views${med !== null ? ` · median ${med.toFixed(1)}` : ""}`,
                            )}
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
            id={`labelshare-watched-${token}`}
            title="Most watched through"
            timescale="Instagram reels only"
            count={mostWatched.length}
            subtitle={`Average watch time as a share of video length. Only Instagram reels report watch time. TikTok doesn't expose it, and Metricool doesn't return video length for every reel — so this covers a subset even within Instagram.${reels.length > 0 ? ` From ${reels.filter((p) => p.completion_pct !== null).length} of ${reels.length} reels.` : ""}`}
          >
            {mostWatched.length === 0 ? (
              <Empty>No video duration data for these accounts.</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {mostWatched.map((p) => {
                  const med = medCompFor(p);
                  return (
                    <BrandRow
                      key={p.external_id}
                      post={p}
                      headline={`${Math.round(p.completion_pct ?? 0)}%`}
                      meta={meta(
                        p,
                        `${compact(p.views)} views${med !== null ? ` · account median ${Math.round(med)}%` : ""}`,
                      )}
                    />
                  );
                })}
              </ul>
            )}
          </Section>
        </div>
      )}
    </div>
  );
}
