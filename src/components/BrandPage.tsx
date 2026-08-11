import { useEffect, useMemo, useState } from "react";
import {
  fetchBrandPlatformRanks,
  fetchBrandSummary,
  fetchPostDetail,
} from "../lib/data";
import { age, compact, monthYear, multiple, shortDate } from "../lib/format";
import { navigate } from "../lib/router";
import type { BrandPlatformRanks, BrandSummary, PostDetail } from "../lib/types";
import { Section, Empty } from "./Section";
import { BrandRow, Stat, platformLabel } from "./BrandRow";
import RankedPlatformTable from "./RankedPlatformTable";
import EngagementExplainer from "./EngagementExplainer";
import ShareManager from "./ShareManager";

const QUARTER_DAYS = 92;
const PAGE_SIZE = 10;
const PAGE_MAX = 50;

export default function BrandPage({ brand }: { brand: string }) {
  const [posts, setPosts] = useState<PostDetail[] | null>(null);
  const [summary, setSummary] = useState<BrandSummary | null>(null);
  const [platforms, setPlatforms] = useState<BrandPlatformRanks[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [latestVisible, setLatestVisible] = useState(PAGE_SIZE);

  useEffect(() => {
    window.scrollTo(0, 0);
    setPosts(null);
    setSummary(null);
    setLatestVisible(PAGE_SIZE);
    Promise.all([
      fetchPostDetail(brand),
      fetchBrandSummary(brand),
      fetchBrandPlatformRanks(brand),
    ])
      .then(([p, s, pl]) => {
        setPosts(p);
        setSummary(s);
        setPlatforms(pl);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [brand]);

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
  // Engagement scores are NOT comparable across platforms (TikTok can only
  // earn likes/comments/shares; Instagram adds saves and follows). Rank
  // within platform+format only — never one mixed list.
  const topEngRateGroups = useMemo(() => {
    const groups = new Map<string, PostDetail[]>();
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
  const mostWatched = useMemo(
    () =>
      (posts ?? [])
        .filter(
          (p) =>
            p.network === "instagram" &&
            p.content_type === "reels" &&
            p.completion_pct !== null,
        )
        .sort((a, b) => (b.completion_pct ?? 0) - (a.completion_pct ?? 0))
        .slice(0, 5),
    [posts],
  );
  const reelsPlatform = platforms.find(
    (p) => p.network === "instagram" && p.content_type === "reels",
  );

  const viewsMeta = (p: PostDetail) =>
    `${shortDate(p.published_at)} · ${compact(p.views)} views vs ${compact(p.median_views)} median`;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 sm:px-10">
      <header className="mb-12">
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate("/");
          }}
          className="text-[13px] text-dim underline underline-offset-2 hover:text-ink"
        >
          ← Board
        </a>
        <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.25em] text-dim">
          {summary?.brand_type === "theme" ? "Theme account" : "Artist"}
        </p>
        <h1 className="mt-1 font-serif text-4xl tracking-tight">{brand}</h1>

        {summary && (
          <>
            <div className="mt-6 flex flex-wrap gap-x-10 gap-y-4">
              <Stat value={String(summary.posts_all_time)} label="Posts" />
              <Stat value={compact(summary.views_all_time)} label="Views" />
              <Stat
                value={`${summary.posts_3m} · ${compact(summary.views_3m)}`}
                label="Posts · views, 3m"
              />
              {summary.first_post && summary.last_post && (
                <Stat
                  value={`${monthYear(summary.first_post)} – ${monthYear(summary.last_post)}`}
                  label="First – last post"
                />
              )}
            </div>

            <RankedPlatformTable rows={platforms} />
            <p className="mt-4 max-w-prose text-[13px] leading-relaxed text-dim">
              "All time" here means since measurements began — first post is
              stated above — not the account's whole life.
            </p>
            <ShareManager
              brandId={summary.brand_id}
              brandName={summary.brand_name}
            />
          </>
        )}
      </header>

      {error && <p className="mb-8 text-sm text-accent">{error}</p>}
      {posts === null && !error && (
        <p className="py-24 text-center text-sm text-dim">Loading…</p>
      )}

      {posts !== null && (
        <div className="space-y-12">
          <Section
            id="brand-leading"
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
            id="brand-latest"
            title="Latest posts"
            count={posts.length}
            subtitle="Everything published, newest first."
          >
            {posts.length === 0 ? (
              <Empty>Nothing here yet.</Empty>
            ) : (
              <>
                <ul className="divide-y divide-line">
                  {posts
                    .slice(0, Math.min(latestVisible, PAGE_MAX))
                    .map((p) => (
                      <BrandRow
                        key={p.external_id}
                        post={p}
                        right={multiple(p.views_multiple)}
                        meta={`${age(p.age_days)} old · ${compact(p.views)} views vs ${compact(p.median_views)} median`}
                      />
                    ))}
                </ul>
                {latestVisible < Math.min(posts.length, PAGE_MAX) && (
                  <button
                    className="mt-4 text-[13px] text-dim underline underline-offset-2 hover:text-ink"
                    onClick={() =>
                      setLatestVisible((v) => Math.min(v + PAGE_SIZE, PAGE_MAX))
                    }
                  >
                    Load more (
                    {Math.min(posts.length, PAGE_MAX) - latestVisible} more)
                  </button>
                )}
              </>
            )}
          </Section>

          <Section
            id="brand-most-viewed"
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
            id="brand-best"
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
            id="brand-best-eng"
            title="Best engagement"
            timescale="last 3 months"
            count={bestEngagement.length}
            subtitle="Posts where people did more than watch, relative to this account's norm."
          >
            {bestEngagement.length === 0 ? (
              <Empty>Nothing above the account's norm this quarter.</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {bestEngagement.map((p) => (
                  <BrandRow
                    key={p.external_id}
                    post={p}
                    headline={multiple(p.engagement_multiple)}
                    meta={`${shortDate(p.published_at)} · ${platformLabel(p.network, p.content_type)} · ${p.engagement_rate?.toFixed(1)} per 100 views${p.median_engagement_rate !== null ? ` vs ${p.median_engagement_rate.toFixed(1)} median` : ""}`}
                  />
                ))}
              </ul>
            )}
          </Section>

          <Section
            id="brand-top-eng"
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
                      {g.posts.map((p) => (
                        <BrandRow
                          key={p.external_id}
                          post={p}
                          headline={p.engagement_rate?.toFixed(1) ?? "—"}
                          meta={`${shortDate(p.published_at)} · ${compact(p.views)} views${p.median_engagement_rate !== null ? ` · median ${p.median_engagement_rate.toFixed(1)}` : ""}`}
                        />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section
            id="brand-watched"
            title="Most watched through"
            timescale="Instagram reels only"
            count={mostWatched.length}
            subtitle={`Average watch time as a share of video length. Only Instagram reels report watch time. TikTok doesn't expose it, and Metricool doesn't return video length for every reel — so this covers a subset even within Instagram.${reelsPlatform ? ` From ${reelsPlatform.completion_available} of ${reelsPlatform.posts} reels.` : ""}`}
          >
            {mostWatched.length === 0 ? (
              <Empty>No video duration data for this account.</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {mostWatched.map((p) => (
                  <BrandRow
                    key={p.external_id}
                    post={p}
                    headline={`${Math.round(p.completion_pct ?? 0)}%`}
                    meta={`${shortDate(p.published_at)} · ${p.avg_watch_seconds?.toFixed(1) ?? "?"}s of ${p.duration_seconds ?? "?"}s${p.median_completion_pct !== null ? ` · account median ${Math.round(p.median_completion_pct)}%` : ""}`}
                  />
                ))}
              </ul>
            )}
          </Section>
        </div>
      )}
    </div>
  );
}
