import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchBrandSkipRates,
  fetchLabelPlatformRanks,
  fetchLabelPosts,
  fetchLabels,
  fetchSkipRoster,
  fetchTrend,
} from "../lib/data";
import { age, compact, multiple, shortDate } from "../lib/format";
import { brandPath, navigate } from "../lib/router";
import type {
  BrandPlatformRanks,
  Label,
  PostDetail,
  SkipRoster,
  TrendRow,
} from "../lib/types";
import { Section, Empty } from "./Section";
import { BrandRow, Stat, platformLabel } from "./BrandRow";
import PlatformFilter, { RollupStat } from "./PlatformFilter";
import {
  onPlatform,
  platformFilterLabel,
  platformLock,
  platformMatches,
  type PlatformFilterKey,
} from "../lib/platforms";
import RankedPlatformTable from "./RankedPlatformTable";
import EngagementExplainer from "./EngagementExplainer";
import SkipRateExplainer from "./SkipRateExplainer";
import LabelShareManager from "./LabelShareManager";
import { AppBar, TopStripe } from "./Chrome";
import TrendChart from "./TrendChart";
import AssistMark from "./AssistMark";

const QUARTER_DAYS = 92;
const PAGE_SIZE = 10;
const PAGE_MAX = 50;

/** Internal label view — every brand carrying this label, with ranks. */
export default function LabelPage({ slug }: { slug: string }) {
  const [label, setLabel] = useState<Label | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [posts, setPosts] = useState<PostDetail[] | null>(null);
  const [platforms, setPlatforms] = useState<BrandPlatformRanks[]>([]);
  const [skipRoster, setSkipRoster] = useState<SkipRoster | null>(null);
  const [skipByKey, setSkipByKey] = useState<Map<string, number | null>>(
    new Map(),
  );
  const [error, setError] = useState<string | null>(null);
  const [latestVisible, setLatestVisible] = useState(PAGE_SIZE);
  const [platform, setPlatform] = useState<PlatformFilterKey>("all");

  const [trend, setTrend] = useState<TrendRow[]>([]);

  // mx_trend carries the label array, so the label filter is client-side on
  // the same cached payload the board already fetched.
  useEffect(() => {
    if (!label) return;
    fetchTrend()
      .then((rows) =>
        setTrend(rows.filter((r) => (r.labels ?? []).includes(label.name))),
      )
      .catch(() => {
        /* additive */
      });
  }, [label]);

  /** Extracted from the mount effect so marking a post can refetch, the same
   *  way BrandPage does. The medians that move belong to the individual
   *  artists, not the label, so the rows have to be re-read rather than
   *  patched: a post leaving its account's baseline changes that account's
   *  other rows on this page too. Takes the label name because on mount it
   *  runs before `label` state has settled. */
  const reload = useCallback(async (labelName: string) => {
    const [p, pr, skips, roster] = await Promise.all([
      fetchLabelPosts(labelName),
      fetchLabelPlatformRanks(labelName),
      fetchBrandSkipRates(),
      fetchSkipRoster(),
    ]);
    setPosts(p);
    setPlatforms(pr);
    setSkipRoster(roster);
    setSkipByKey(
      new Map(
        skips.map((r) => [
          `${r.brand_name}|${r.network}|${r.content_type}`,
          r.median_skip_rate,
        ]),
      ),
    );
  }, []);

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
        if (found.brands === 0) {
          // Nothing to fetch. No brand carries this label, so post_detail and
          // brand_platform_ranks can only come back empty — and skipping the
          // round trip also stops a failed fetch replacing the empty state
          // with an error on a label that simply has no brands yet.
          setPosts([]);
          setPlatforms([]);
          return;
        }
        await reload(found.name);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [slug, reload]);

  /* Both sources carry network and content_type per row, so the filter is a
   * slice of what was already fetched. `posts` stays raw — it is the loading
   * sentinel, and the brand-count tiles below are a separate problem. */
  const filtered = platform !== "all";
  const fPosts = useMemo(
    () => onPlatform(posts ?? [], platform),
    [posts, platform],
  );
  const fPlatforms = useMemo(
    () => onPlatform(platforms, platform),
    [platforms, platform],
  );
  const reelsInFilter = platformMatches(
    { network: "instagram", content_type: "reels" },
    platform,
  );

  const byBrand = useMemo(() => {
    const m = new Map<string, BrandPlatformRanks[]>();
    for (const r of fPlatforms) {
      const arr = m.get(r.brand_name) ?? [];
      arr.push(r);
      m.set(r.brand_name, arr);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [fPlatforms]);

  const recent = useMemo(
    () => fPosts.filter((p) => p.age_days <= QUARTER_DAYS),
    [fPosts],
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
    () => [...fPosts].sort((a, b) => b.views - a.views).slice(0, 10),
    [fPosts],
  );
  const bestScoring = useMemo(
    () =>
      [...fPosts]
        .sort((a, b) => b.views_multiple - a.views_multiple)
        .slice(0, 10),
    [fPosts],
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
    for (const p of fPosts) {
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
  }, [fPosts]);
  const reels = useMemo(
    () =>
      fPosts.filter(
        (p) => p.network === "instagram" && p.content_type === "reels",
      ),
    [fPosts],
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

  /** Bound to the resolved label. Only rendered where `label` is non-null. */
  const reloadThis = useCallback(async () => {
    if (label) await reload(label.name);
  }, [label, reload]);

  // Platform-split at source, so these two DO follow the filter.
  const totalPosts = fPlatforms.reduce((n, r) => n + r.posts, 0);
  const totalViews = fPlatforms.reduce((n, r) => n + r.views, 0);

  return (
    <>
      <TopStripe />
      <AppBar current="label" />

      <div className="wrap">
        <div className="pagehead">
          <h1>{label?.name ?? slug}</h1>
          <p className="sub">Label</p>
        </div>

        {label && label.brands > 0 && (
          <>
            <PlatformFilter value={platform} onChange={setPlatform} />

            <div className="kpis">
              {/* Brand counts come from mx_labels, which counts brands
                  carrying the label and knows nothing about platforms — under
                  a selection these are not "brands on TikTok", so they are
                  marked like the other rollups. The fourth tile is summed
                  from the platform rows and does follow the filter. */}
              <RollupStat
                value={String(label.brands)}
                label="Brands"
                filtered={filtered}
              />
              <RollupStat
                value={String(label.artist_brands)}
                label="Artists"
                filtered={filtered}
              />
              <RollupStat
                value={String(label.theme_brands)}
                label="Theme accounts"
                filtered={filtered}
              />
              <Stat
                value={totalViews > 0 ? compact(totalViews) : String(totalPosts)}
                label={totalViews > 0 ? "Views" : "Posts"}
                meta={totalViews > 0 ? `${totalPosts} posts` : undefined}
              />
            </div>

            <div className="card">
              <SkipRateExplainer roster={skipRoster} />
            </div>

            <LabelShareManager labelName={label.name} />
          </>
        )}

      {error && <p className="err-line">{error}</p>}

      {notFound && (
        <p className="empty">
          No label with that address.
        </p>
      )}

      {!notFound && posts === null && !error && (
        <p className="empty">Loading…</p>
      )}

      {/* A label with no brands yet is an ordinary state, not an error. */}
      {!notFound && posts !== null && label && label.brands === 0 && (
        <div className="empty">
          <b>No brands assigned to this label yet.</b>
          <div style={{ marginTop: 6 }}>
            Tag brands from the Brands panel and they&rsquo;ll appear here.
          </div>
        </div>
      )}

      {!notFound && posts !== null && label && label.brands > 0 && (
        <>
          {byBrand.length > 0 && (
            <Section
              id={`label-${slug}-brands`}
              title="Brands"
              count={byBrand.length}
              subtitle="Per-platform medians and roster position for each brand under this label."
            >
              <div>
                {byBrand.map(([brand, rows]) => (
                  <div key={brand}>
                    <a
                      href={brandPath(brand)}
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(brandPath(brand));
                      }}
                      style={{fontSize:18,fontWeight:700,color:"inherit"}}
                    >
                      {brand}
                    </a>
                    <RankedPlatformTable rows={rows} skipByKey={skipByKey} />
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
                    assist={
                      <AssistMark
                        externalId={p.external_id}
                        isPaid={p.is_assisted}
                        reload={reloadThis}
                        showControl={true}
                      />
                    }
                  />
                ))}
              </div>
            )}
          </Section>

          <Section
            id={`label-${slug}-latest`}
            title="Latest posts"
            count={fPosts.length}
            subtitle="Everything published across this label's brands, newest first."
          >
            {fPosts.length === 0 ? (
              <Empty>Nothing here yet.</Empty>
            ) : (
              <>
                <div>
                  {fPosts.slice(0, Math.min(latestVisible, PAGE_MAX)).map((p) => (
                    <BrandRow
                      key={p.external_id}
                      post={p}
                      right={multiple(p.views_multiple)}
                      meta={meta(
                        p,
                        `${age(p.age_days)} old · ${compact(p.views)} views vs ${compact(p.median_views)} median`,
                      )}
                      assist={
                        <AssistMark
                          externalId={p.external_id}
                          isPaid={p.is_assisted}
                          reload={reloadThis}
                          showControl={true}
                        />
                      }
                    />
                  ))}
                </div>
                {latestVisible < Math.min(fPosts.length, PAGE_MAX) && (
                  <button
                    className="lnk"
                    onClick={() =>
                      setLatestVisible((v) => Math.min(v + PAGE_SIZE, PAGE_MAX))
                    }
                  >
                    Load more (
                    {Math.min(fPosts.length, PAGE_MAX) - latestVisible} more)
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
            id={`label-${slug}-best`}
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

          <div>
            <h2 className="lab-mono">
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
              <div>
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
              </div>
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
                          meta={meta(
                            p,
                            `${compact(p.views)} views${p.median_engagement_rate !== null ? ` · median ${p.median_engagement_rate.toFixed(1)}` : ""}`,
                          )}
                        />
                      ))}
                    </div>
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
            subtitle={`Average watch time as a share of video length. Only Instagram reels report watch time. TikTok doesn't expose it, and Metricool doesn't return video length for every reel — so this covers a subset even within Instagram.${reelsInFilter && reels.length > 0 ? ` From ${reels.filter((p) => p.completion_pct !== null).length} of ${reels.length} reels.` : ""}`}
          >
            {mostWatched.length === 0 ? (
              <Empty>
                {reelsInFilter
                  ? "No video duration data for these accounts."
                  : `Instagram reels are outside the ${platformFilterLabel(platform)} filter.`}
              </Empty>
            ) : (
              <div>
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
              </div>
            )}
          </Section>

          <TrendChart
            rows={trend}
            showArtistSelector
            platformKey={platformLock(platform)}
          />
        </>
      )}
      </div>
    </>
  );
}
