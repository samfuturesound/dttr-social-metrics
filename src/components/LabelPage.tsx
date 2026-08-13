import { useEffect, useMemo, useState } from "react";
import {
  fetchLabelPlatformRanks,
  fetchLabelPosts,
  fetchLabels,
} from "../lib/data";
import { age, compact, multiple, shortDate } from "../lib/format";
import { brandPath, navigate } from "../lib/router";
import type { BrandPlatformRanks, Label, PostDetail } from "../lib/types";
import { Section, Empty } from "./Section";
import { BrandRow, Stat, platformLabel } from "./BrandRow";
import RankedPlatformTable from "./RankedPlatformTable";
import EngagementExplainer from "./EngagementExplainer";
import LabelShareManager from "./LabelShareManager";

const QUARTER_DAYS = 92;
const PAGE_SIZE = 10;
const PAGE_MAX = 50;

/** Internal label view — every brand carrying this label, with ranks. */
export default function LabelPage({ slug }: { slug: string }) {
  const [label, setLabel] = useState<Label | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [posts, setPosts] = useState<PostDetail[] | null>(null);
  const [platforms, setPlatforms] = useState<BrandPlatformRanks[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [latestVisible, setLatestVisible] = useState(PAGE_SIZE);

  useEffect(() => {
    window.scrollTo(0, 0);
    setPosts(null);
    setLatestVisible(PAGE_SIZE);
    fetchLabels()
      .then(async (labels) => {
        const found = labels.find((l) => l.slug === slug);
        if (!found) {
          setNotFound(true);
          setPosts([]);
          return;
        }
        setLabel(found);
        const [p, pr] = await Promise.all([
          fetchLabelPosts(found.name),
          fetchLabelPlatformRanks(found.name),
        ]);
        setPosts(p);
        setPlatforms(pr);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [slug]);

  const byBrand = useMemo(() => {
    const m = new Map<string, BrandPlatformRanks[]>();
    for (const r of platforms) {
      const arr = m.get(r.brand_name) ?? [];
      arr.push(r);
      m.set(r.brand_name, arr);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [platforms]);

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

  // On a label page every row is a different brand, so the brand leads the meta.
  const meta = (p: PostDetail, tail: string) => `${p.brand_name} · ${tail}`;

  const totalPosts = platforms.reduce((n, r) => n + r.posts, 0);
  const totalViews = platforms.reduce((n, r) => n + r.views, 0);

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
          Label
        </p>
        <h1 className="mt-1 font-serif text-4xl tracking-tight">
          {label?.name ?? slug}
        </h1>

        {label && label.brands > 0 && (
          <>
            <div className="mt-6 flex flex-wrap gap-x-10 gap-y-4">
              <Stat value={String(label.brands)} label="Brands" />
              <Stat value={String(label.artist_brands)} label="Artists" />
              <Stat value={String(label.theme_brands)} label="Theme accounts" />
              {totalPosts > 0 && (
                <Stat value={String(totalPosts)} label="Posts" />
              )}
              {totalViews > 0 && (
                <Stat value={compact(totalViews)} label="Views" />
              )}
            </div>
            <LabelShareManager labelName={label.name} />
          </>
        )}
      </header>

      {error && <p className="mb-8 text-sm text-accent">{error}</p>}

      {notFound && (
        <p className="py-24 text-center text-sm text-dim">
          No label with that address.
        </p>
      )}

      {!notFound && posts === null && !error && (
        <p className="py-24 text-center text-sm text-dim">Loading…</p>
      )}

      {/* A label with no brands yet is an ordinary state, not an error. */}
      {!notFound && posts !== null && label && label.brands === 0 && (
        <div className="py-24 text-center">
          <p className="font-serif text-3xl">
            No brands tagged with this label yet.
          </p>
          <p className="mt-3 text-sm text-dim">
            Tag brands from the Brands panel and they'll appear here.
          </p>
        </div>
      )}

      {!notFound && posts !== null && label && label.brands > 0 && (
        <div className="space-y-12">
          {byBrand.length > 0 && (
            <Section
              id={`label-${slug}-brands`}
              title="Brands"
              count={byBrand.length}
              subtitle="Per-platform medians and roster position for each brand under this label."
            >
              <div className="space-y-8 pt-4">
                {byBrand.map(([brand, rows]) => (
                  <div key={brand}>
                    <a
                      href={brandPath(brand)}
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(brandPath(brand));
                      }}
                      className="font-serif text-xl hover:underline"
                    >
                      {brand}
                    </a>
                    <RankedPlatformTable rows={rows} />
                  </div>
                ))}
              </div>
            </Section>
          )}

          <Section
            id={`label-${slug}-leading`}
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
            id={`label-${slug}-latest`}
            title="Latest posts"
            count={posts.length}
            subtitle="Everything published across this label's brands, newest first."
          >
            {posts.length === 0 ? (
              <Empty>Nothing here yet.</Empty>
            ) : (
              <>
                <ul className="divide-y divide-line">
                  {posts.slice(0, Math.min(latestVisible, PAGE_MAX)).map((p) => (
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
            id={`label-${slug}-most-viewed`}
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
            id={`label-${slug}-best`}
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
            id={`label-${slug}-best-eng`}
            title="Best engagement"
            timescale="last 3 months"
            count={bestEngagement.length}
            subtitle="Posts where people did more than watch, relative to the account's norm."
          >
            {bestEngagement.length === 0 ? (
              <Empty>Nothing above the norm this quarter.</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {bestEngagement.map((p) => (
                  <BrandRow
                    key={p.external_id}
                    post={p}
                    headline={multiple(p.engagement_multiple)}
                    meta={meta(
                      p,
                      `${platformLabel(p.network, p.content_type)} · ${p.engagement_rate?.toFixed(1)} per 100 views${p.median_engagement_rate !== null ? ` vs ${p.median_engagement_rate.toFixed(1)} median` : ""}`,
                    )}
                  />
                ))}
              </ul>
            )}
          </Section>

          <Section
            id={`label-${slug}-top-eng`}
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
                          meta={meta(
                            p,
                            `${compact(p.views)} views${p.median_engagement_rate !== null ? ` · median ${p.median_engagement_rate.toFixed(1)}` : ""}`,
                          )}
                        />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section
            id={`label-${slug}-watched`}
            title="Most watched through"
            timescale="Instagram reels only"
            count={mostWatched.length}
            subtitle={`Average watch time as a share of video length. Only Instagram reels report watch time. TikTok doesn't expose it, and Metricool doesn't return video length for every reel — so this covers a subset even within Instagram.${reels.length > 0 ? ` From ${reels.filter((p) => p.completion_pct !== null).length} of ${reels.length} reels.` : ""}`}
          >
            {mostWatched.length === 0 ? (
              <Empty>No video duration data for these accounts.</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {mostWatched.map((p) => (
                  <BrandRow
                    key={p.external_id}
                    post={p}
                    headline={`${Math.round(p.completion_pct ?? 0)}%`}
                    meta={meta(
                      p,
                      `${p.avg_watch_seconds?.toFixed(1) ?? "?"}s of ${p.duration_seconds ?? "?"}s${p.median_completion_pct !== null ? ` · account median ${Math.round(p.median_completion_pct)}%` : ""}`,
                    )}
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
