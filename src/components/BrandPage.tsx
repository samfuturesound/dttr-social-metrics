import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchBrandPlatformRanks,
  fetchBrandSkipRates,
  fetchBrandSummary,
  fetchPostDetail,
  fetchSkipRoster,
  fetchTrend,
} from "../lib/data";
import { age, compact, monthYear, multiple, shortDate } from "../lib/format";
import { labelPath, navigate } from "../lib/router";
import type {
  BrandPlatformRanks,
  BrandSummary,
  PostDetail,
  SkipRoster,
  TrendRow,
} from "../lib/types";
import { Section, Empty } from "./Section";
import { BrandRow, LabelTags, Stat, platformLabel } from "./BrandRow";
import RankedPlatformTable from "./RankedPlatformTable";
import { AppBar, TopStripe } from "./Chrome";
import TrendChart from "./TrendChart";
import AssistMark from "./AssistMark";
import EngagementExplainer from "./EngagementExplainer";
import SkipRateExplainer from "./SkipRateExplainer";
import ShareManager from "./ShareManager";

const QUARTER_DAYS = 92;
const PAGE_SIZE = 10;
const PAGE_MAX = 50;

export default function BrandPage({ brand }: { brand: string }) {
  const [posts, setPosts] = useState<PostDetail[] | null>(null);
  const [summary, setSummary] = useState<BrandSummary | null>(null);
  const [platforms, setPlatforms] = useState<BrandPlatformRanks[]>([]);
  const [skipRoster, setSkipRoster] = useState<SkipRoster | null>(null);
  const [skipByKey, setSkipByKey] = useState<Map<string, number | null>>(
    new Map(),
  );
  const [error, setError] = useState<string | null>(null);
  const [latestVisible, setLatestVisible] = useState(PAGE_SIZE);

  const [trend, setTrend] = useState<TrendRow[]>([]);

  // Same cached mx_trend fetch the board uses; filtered to this account.
  useEffect(() => {
    fetchTrend()
      .then((rows) => setTrend(rows.filter((r) => r.brand_name === brand)))
      .catch(() => {
        /* additive */
      });
  }, [brand]);

  /** Extracted from the mount effect so marking a post can refetch. The
   *  medians genuinely move when a post leaves the baseline, so the real
   *  numbers have to be re-read rather than patched locally. */
  const reload = useCallback(async () => {
    try {
      const [p, s, pl, skips, roster] = await Promise.all([
        fetchPostDetail(brand),
        fetchBrandSummary(brand),
        fetchBrandPlatformRanks(brand),
        fetchBrandSkipRates(brand),
        fetchSkipRoster(),
      ]);
      setPosts(p);
      setSummary(s);
      setPlatforms(pl);
      setSkipRoster(roster);
      setSkipByKey(
        new Map(
          skips.map((r) => [
            `${r.brand_name}|${r.network}|${r.content_type}`,
            r.median_skip_rate,
          ]),
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [brand]);

  useEffect(() => {
    window.scrollTo(0, 0);
    setPosts(null);
    setSummary(null);
    setLatestVisible(PAGE_SIZE);
    reload();
  }, [brand, reload]);

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
    <>
      <TopStripe />
      <AppBar current="brand" />

      <div className="wrap">
        <div className="pagehead">
          <h1>{brand}</h1>
          <p className="sub">
            {summary?.brand_type === "theme" ? "Theme account" : "Artist"}
            {summary?.labels && summary.labels.length > 0 && (
              <> · <LabelTags labels={summary.labels} /></>
            )}
          </p>
        </div>

        {summary && (
          <>
            <div className="kpis">
              <Stat value={String(summary.posts_all_time)} label="Posts" meta="all time" />
              <Stat value={compact(summary.views_all_time)} label="Views" meta="all time" />
              <Stat
                value={`${summary.posts_3m} · ${compact(summary.views_3m)}`}
                label="Posts · views"
                meta="last 3 months"
              />
              <Stat
                value={
                  summary.first_post && summary.last_post
                    ? `${monthYear(summary.first_post)} – ${monthYear(summary.last_post)}`
                    : "—"
                }
                label="First – last post"
              />
            </div>

            <div className="card">
              <div className="eyebrow">
                <span>Per platform, with roster position</span>
              </div>
              <RankedPlatformTable rows={platforms} skipByKey={skipByKey} />
              <p className="note">
                &ldquo;All time&rdquo; here means since measurements began —
                first post is stated above — not the account&rsquo;s whole life.
              </p>
              <hr className="r" />
              <SkipRateExplainer roster={skipRoster} />
            </div>

            <ShareManager
              brandId={summary.brand_id}
              brandName={summary.brand_name}
            />
          </>
        )}

      {error && <p className="err-line">{error}</p>}
      {posts === null && !error && (
        <p className="empty">Loading…</p>
      )}

      {posts !== null && (
        <>
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
              <div>
                {leading.map((p) => (
                  <BrandRow
                    key={p.external_id}
                    post={p}
                    headline={multiple(p.views_multiple)}
                    meta={viewsMeta(p)}
                    assist={
                      <AssistMark
                        externalId={p.external_id}
                        isPaid={p.is_assisted}
                        reload={reload}
                        showControl={true}
                      />
                    }
                  />
                ))}
              </div>
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
                <div>
                  {posts
                    .slice(0, Math.min(latestVisible, PAGE_MAX))
                    .map((p) => (
                      <BrandRow
                        key={p.external_id}
                        post={p}
                        right={multiple(p.views_multiple)}
                        meta={`${age(p.age_days)} old · ${compact(p.views)} views vs ${compact(p.median_views)} median`}
                        assist={
                          <AssistMark
                            externalId={p.external_id}
                            isPaid={p.is_assisted}
                            reload={reload}
                            showControl={true}
                          />
                        }
                      />
                    ))}
                </div>
                {latestVisible < Math.min(posts.length, PAGE_MAX) && (
                  <button
                    className="lnk"
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
            <div>
              {mostViewed.map((p) => (
                <BrandRow
                  key={p.external_id}
                  post={p}
                  headline={compact(p.views)}
                  meta={`${shortDate(p.published_at)} · ${multiple(p.views_multiple)} its baseline`}
                />
              ))}
            </div>
          </Section>

          <Section
            id="brand-best"
            title="Best scoring"
            timescale="all time"
            count={bestScoring.length}
            subtitle="Furthest above this account's own typical performance."
          >
            <div>
              {bestScoring.map((p) => (
                <BrandRow
                  key={p.external_id}
                  post={p}
                  headline={multiple(p.views_multiple)}
                  meta={viewsMeta(p)}
                />
              ))}
            </div>
          </Section>

          <div>
            <h2 className="lab-mono">
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
              <div>
                {bestEngagement.map((p) => (
                  <BrandRow
                    key={p.external_id}
                    post={p}
                    headline={multiple(p.engagement_multiple)}
                    meta={`${shortDate(p.published_at)} · ${platformLabel(p.network, p.content_type)} · ${p.engagement_rate?.toFixed(1)} per 100 views${p.median_engagement_rate !== null ? ` vs ${p.median_engagement_rate.toFixed(1)} median` : ""}`}
                  />
                ))}
              </div>
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
              <div>
                {topEngRateGroups.map((g) => (
                  <div key={g.label}>
                    <h4 className="lab-mono">
                      {g.label}
                    </h4>
                    <div>
                      {g.posts.map((p) => (
                        <BrandRow
                          key={p.external_id}
                          post={p}
                          headline={p.engagement_rate?.toFixed(1) ?? "—"}
                          meta={`${shortDate(p.published_at)} · ${compact(p.views)} views${p.median_engagement_rate !== null ? ` · median ${p.median_engagement_rate.toFixed(1)}` : ""}`}
                        />
                      ))}
                    </div>
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
              <div>
                {mostWatched.map((p) => (
                  <BrandRow
                    key={p.external_id}
                    post={p}
                    headline={`${Math.round(p.completion_pct ?? 0)}%`}
                    meta={`${shortDate(p.published_at)} · ${p.avg_watch_seconds?.toFixed(1) ?? "?"}s of ${p.duration_seconds ?? "?"}s${p.median_completion_pct !== null ? ` · account median ${Math.round(p.median_completion_pct)}%` : ""}`}
                  />
                ))}
              </div>
            )}
          </Section>

          <TrendChart rows={trend} showArtistSelector={false} />
        </>
      )}
      </div>
    </>
  );
}
