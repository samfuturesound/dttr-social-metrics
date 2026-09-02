import { useEffect, useMemo, useState } from "react";
import {
  fetchShareBrandId,
  fetchSharePosts,
  fetchShareSummary,
  fetchShareTrend,
} from "../lib/data";
import { age, compact, multiple, shortDate } from "../lib/format";
import type { SharePost, ShareSummary, TrendRow } from "../lib/types";
import { Section, Empty } from "./Section";
import { BrandRow, PlatformTable, platformLabel } from "./BrandRow";
import { ShareBar, TopStripe } from "./Chrome";
import TrendChart from "./TrendChart";
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
 *
 * Everything on this page is derived from the two calls already made. Anon
 * runs against a 3s statement timeout, so no view change may add a round trip.
 */
export default function SharePage({ token }: { token: string }) {
  const [posts, setPosts] = useState<SharePost[] | null>(null);
  const [summary, setSummary] = useState<ShareSummary[]>([]);
  /** undefined = not resolved yet, null = dead token, number = live token. */
  const [brandId, setBrandId] = useState<number | null | undefined>(undefined);
  const [trend, setTrend] = useState<TrendRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [latestVisible, setLatestVisible] = useState(PAGE_SIZE);

  useEffect(() => {
    window.scrollTo(0, 0);
    // Three calls, one round trip: they go out together, and the brand-id
    // lookup is a single indexed read on brand_shares.
    Promise.all([
      fetchSharePosts(token),
      fetchShareSummary(token),
      fetchShareBrandId(token),
      fetchShareTrend(token),
    ])
      .then(([p, s, id, tr]) => {
        setPosts(p);
        setSummary(s);
        setBrandId(id);
        setTrend(tr);
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
  const platformCount = new Set(summary.map((s) => s.network)).size;

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
      <>
        <TopStripe />
        <ShareBar />
        <div className="wrap">
          <div className="ratewarn" style={{ marginTop: 24 }}>
            <h4>Could not load</h4>
            <p>{error}</p>
          </div>
        </div>
      </>
    );
  }

  if (posts === null) {
    return (
      <>
        <TopStripe />
        <ShareBar />
        <div className="wrap">
          <div className="empty" style={{ marginTop: 24 }}>Loading&hellip;</div>
        </div>
      </>
    );
  }

  // Dead token — unknown, revoked, or past expires_on. mx_share_brand_id
  // returns null for exactly these three, and for nothing else.
  if (brandId === null) {
    return (
      <>
        <TopStripe />
        <ShareBar />
        <div className="wrap">
          <div className="card" style={{ marginTop: 24, maxWidth: 460 }}>
            <div className="eyebrow">
              <span>Link inactive</span>
            </div>
            <h2 style={{ fontSize: 22 }}>This link is no longer active</h2>
            <p className="note">
              It may have been revoked or reached its expiry date. Ask whoever
              sent it for a new one.
            </p>
          </div>
        </div>
      </>
    );
  }

  // Live token, no figures yet. A brand added today has no rows in
  // post_detail_mv until the overnight refresh, so both functions come back
  // empty even though nothing is wrong with the link.
  if (posts.length === 0 && summary.length === 0) {
    return (
      <>
        <TopStripe />
        <ShareBar subtitle="Social performance" />
        <div className="wrap">
          <div className="card" style={{ marginTop: 24, maxWidth: 460 }}>
            <div className="eyebrow">
              <span>No data yet</span>
            </div>
            <h2 style={{ fontSize: 22 }}>Nothing to show yet</h2>
            <p className="note">
              This account was added recently. Figures appear after the next
              overnight update — the link itself is fine, so keep it.
            </p>
          </div>
        </div>
      </>
    );
  }

  // mx_share_trend returns no brand column — a share is one account — so the
  // name comes from the summary we already hold rather than another call.
  const trendRows = trend.map((r) => ({ ...r, brand_name: brandName }));

  const viewsMeta = (p: SharePost) =>
    `${shortDate(p.published_at)} · ${compact(p.views)} views vs ${compact(p.median_views)} median`;

  return (
    <>
      <TopStripe />
      <ShareBar subtitle="Social performance" />

      <div className="wrap">
        <div className="pagehead">
          <h1>{brandName}</h1>
          <p className="sub">
            These are {brandName}&rsquo;s own figures — no other account&rsquo;s
            data appears here. Every post is measured against this
            account&rsquo;s own typical performance, on the same platform and in
            the same format.
          </p>
        </div>

        <div className="kpis">
          <div className="kpi">
            <div className="k">Posts</div>
            <div className="v">{totalPosts}</div>
            <div className="m">since measurement began</div>
          </div>
          <div className="kpi">
            <div className="k">Views</div>
            <div className="v">{compact(totalViews)}</div>
            <div className="m">all recorded posts</div>
          </div>
          <div className="kpi">
            <div className="k">Most recent</div>
            <div className="v">{lastPost ? shortDate(lastPost) : "—"}</div>
            <div className="m">last post seen</div>
          </div>
          <div className="kpi">
            <div className="k">Platforms</div>
            <div className="v">{platformCount}</div>
            <div className="m">measured separately</div>
          </div>
        </div>

        <div className="card">
          <div className="eyebrow">
            <span>Per platform</span>
          </div>
          <PlatformTable rows={summary} compact={compact} />
          <p className="note">
            &ldquo;All time&rdquo; here means since measurements began — not the
            account&rsquo;s whole life.
          </p>
        </div>

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
            <div>
              {leading.map((p) => (
                <BrandRow
                  key={p.external_id}
                  post={p}
                  headline={multiple(p.views_multiple)}
                  meta={viewsMeta(p)}
                />
              ))}
            </div>
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
              <div>
                {latest.slice(0, Math.min(latestVisible, PAGE_MAX)).map((p) => (
                  <BrandRow
                    key={p.external_id}
                    post={p}
                    right={multiple(p.views_multiple)}
                    meta={`${age(p.age_days)} old · ${compact(p.views)} views vs ${compact(p.median_views)} median`}
                  />
                ))}
              </div>
              {latestVisible < Math.min(latest.length, PAGE_MAX) && (
                <button
                  className="btn"
                  style={{ marginTop: 12 }}
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
          id="share-best"
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

        <div className="card">
          <div className="eyebrow">
            <span>Engagement</span>
          </div>
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
            <Empty>Nothing above the account&rsquo;s norm this quarter.</Empty>
          ) : (
            <div>
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
            </div>
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
            <div>
              {topEngRateGroups.map((g) => (
                <div key={g.label} style={{ marginBottom: 18 }}>
                  <div className="lab-mono" style={{ marginBottom: 4 }}>
                    {g.label}
                  </div>
                  <div>
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
                  </div>
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
            <div>
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
            </div>
          )}
        </Section>

        <TrendChart rows={trendRows} showArtistSelector={false} />
      </div>
    </>
  );
}
