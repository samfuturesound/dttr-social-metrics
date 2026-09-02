import { useEffect, useMemo, useState } from "react";
import {
  fetchLabelShareName,
  fetchLabelSharePosts,
  fetchLabelShareSummary,
  fetchLabelShareTrend,
} from "../lib/data";
import { age, compact, multiple, shortDate } from "../lib/format";
import type { LabelShareSummary, SharePost, TrendRow } from "../lib/types";
import { Section, Empty } from "./Section";
import { BrandRow, PlatformTable, platformLabel } from "./BrandRow";
import { ShareBar, TopStripe } from "./Chrome";
import TrendChart from "./TrendChart";
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
  const [trend, setTrend] = useState<TrendRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [latestVisible, setLatestVisible] = useState(PAGE_SIZE);

  useEffect(() => {
    window.scrollTo(0, 0);
    Promise.all([
      fetchLabelSharePosts(token),
      fetchLabelShareSummary(token),
      fetchLabelShareName(token),
      fetchLabelShareTrend(token),
    ])
      .then(([p, s, n, tr]) => {
        setPosts(p);
        setSummary(s);
        setLabelName(n);
        setTrend(tr);
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

  // Dead token — unknown, revoked, or past expires_on. mx_label_share_name
  // returns null for exactly those, and a label name for anything live, so it
  // is the same signal mx_share_brand_id gives the single-brand share page.
  // Row counts can't be used: a live label whose brands have no rows in
  // post_detail_mv yet also comes back empty.
  if (!labelName) {
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

  const meta = (p: SharePost, tail: string) => `${p.brand_name} · ${tail}`;

  return (
    <>
      <TopStripe />
      <ShareBar subtitle="Social performance" />

      <div className="wrap">
        <div className="pagehead">
          <h1>{labelName ?? "Label"}</h1>
          <p className="sub">
            These are the figures for {labelName ?? "this label"}&rsquo;s
            accounts. Every post is measured against its own account&rsquo;s
            typical performance, on the same platform and in the same format.
          </p>
        </div>

        <div className="kpis">
          <div className="kpi">
            <div className="k">Accounts</div>
            <div className="v">{byBrand.length}</div>
            <div className="m">on this label</div>
          </div>
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
            <div className="k">Platforms</div>
            <div className="v">{new Set(summary.map((s) => s.network)).size}</div>
            <div className="m">measured separately</div>
          </div>
        </div>

        {byBrand.length > 0 &&
          byBrand.map(([brand, rows]) => (
            <div className="card" key={brand}>
              <div className="eyebrow">
                <span>{brand}</span>
              </div>
              <PlatformTable rows={rows} compact={compact} />
            </div>
          ))}

        <p className="note" style={{ marginBottom: 14 }}>
          &ldquo;All time&rdquo; here means since measurements began — not the
          accounts&rsquo; whole life.
        </p>

      {posts.length === 0 ? (
        <div className="card" style={{ maxWidth: 460 }}>
          <div className="eyebrow">
            <span>No data yet</span>
          </div>
          <h2 style={{ fontSize: 22 }}>Nothing to show yet</h2>
          <p className="note">
            These accounts were added recently. Figures appear after the next
            overnight update — the link itself is fine, so keep it.
          </p>
        </div>
      ) : (
        <>
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
              <div>
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
              </div>
            )}
          </Section>

          <Section
            id={`labelshare-latest-${token}`}
            title="Latest posts"
            count={latest.length}
            subtitle="Everything published, newest first."
          >
            <div>
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
          </Section>

          <Section
            id={`labelshare-most-viewed-${token}`}
            title="Most viewed"
            timescale="all time"
            count={mostViewed.length}
            subtitle="Raw reach — biggest posts regardless of how normal that is for the account."
          >
            <div>
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
            </div>
          </Section>

          <Section
            id={`labelshare-best-${token}`}
            title="Best scoring"
            timescale="all time"
            count={bestScoring.length}
            subtitle="Furthest above the account's own typical performance."
          >
            <div>
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
            </div>
          </Section>

          <div className="card">
            <div className="eyebrow">
              <span>Engagement</span>
            </div>
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
              <div>
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
              </div>
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
                            meta={meta(
                              p,
                              `${compact(p.views)} views${med !== null ? ` · median ${med.toFixed(1)}` : ""}`,
                            )}
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
            id={`labelshare-watched-${token}`}
            title="Most watched through"
            timescale="Instagram reels only"
            count={mostWatched.length}
            subtitle={`Average watch time as a share of video length. Only Instagram reels report watch time. TikTok doesn't expose it, and Metricool doesn't return video length for every reel — so this covers a subset even within Instagram.${reels.length > 0 ? ` From ${reels.filter((p) => p.completion_pct !== null).length} of ${reels.length} reels.` : ""}`}
          >
            {mostWatched.length === 0 ? (
              <Empty>No video duration data for these accounts.</Empty>
            ) : (
              <div>
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
