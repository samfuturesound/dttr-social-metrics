import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, MOCK } from "../lib/supabase";
import {
  fetchAccountScores,
  fetchBest,
  fetchBrands,
  fetchLabels,
  fetchBrandSkipRates,
  fetchSkipRoster,
  fetchInterventions,
  fetchLeading,
  fetchNotes,
  fetchPeriod,
  fetchRecent,
  fetchStreaming,
  fetchTopViews,
  fetchTrend,
} from "../lib/data";
import { compact, multiple, shortDate, todayLabel } from "../lib/format";
import type {
  AccountScore,
  Brand,
  Label,
  SkipRoster,
  FlaggedPost,
  Intervention,
  Period,
  PostNote,
  StreamingCapture,
  TrendRow,
} from "../lib/types";
import PostRow from "./PostRow";
import BrandAdmin from "./BrandAdmin";
import PlatformFilter, { RollupNote, RollupStat } from "./PlatformFilter";
import { onPlatform, platformLock, type PlatformFilterKey } from "../lib/platforms";
import { Section, Empty } from "./Section";
import { LabelTags } from "./BrandRow";
import { SkipRatePanel } from "./SkipRateExplainer";
import { AppBar, TopStripe } from "./Chrome";
import TrendChart from "./TrendChart";
import { brandPath, labelPath, navigate } from "../lib/router";

const PAGE_SIZE = 10;
const PAGE_MAX = 50;

export default function Dashboard() {
  const [leading, setLeading] = useState<FlaggedPost[] | null>(null);
  const [recent, setRecent] = useState<FlaggedPost[]>([]);
  const [best, setBest] = useState<FlaggedPost[]>([]);
  const [topViews, setTopViews] = useState<FlaggedPost[]>([]);
  const [scores, setScores] = useState<AccountScore[]>([]);
  const [period, setPeriod] = useState<Period | null>(null);
  const [notes, setNotes] = useState<PostNote[]>([]);
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [streaming, setStreaming] = useState<StreamingCapture[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [skipRoster, setSkipRoster] = useState<SkipRoster | null>(null);
  const [skipByBrand, setSkipByBrand] = useState<Map<string, number | null>>(
    new Map(),
  );
  const [error, setError] = useState<string | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [explainer, setExplainer] = useState<null | "score" | "skip">(null);
  const [trend, setTrend] = useState<TrendRow[]>([]);
  const [platform, setPlatform] = useState<PlatformFilterKey>("all");

  const load = useCallback(async () => {
    try {
      const [fl, re, be, tv, sc, pd, allBrands, allLabels] = await Promise.all([
        fetchLeading(),
        fetchRecent(),
        fetchBest(),
        fetchTopViews(),
        fetchAccountScores(),
        fetchPeriod(),
        fetchBrands(),
        fetchLabels(),
      ]);
      const [roster, skips] = await Promise.all([
        fetchSkipRoster(),
        fetchBrandSkipRates(),
      ]);
      setSkipRoster(roster);
      setSkipByBrand(
        new Map(skips.map((r) => [r.brand_name, r.median_skip_rate])),
      );
      setLeading(fl);
      setRecent(re);
      setBest(be);
      setTopViews(tv);
      setScores(sc);
      setPeriod(pd);
      setBrands(allBrands);
      setLabels(allLabels);
      const ids = [
        ...new Set([...fl, ...re, ...be, ...tv].map((p) => p.external_id)),
      ];
      const [n, i, s] = await Promise.all([
        fetchNotes(ids),
        fetchInterventions(ids),
        fetchStreaming(ids),
      ]);
      setNotes(n);
      setInterventions(i);
      setStreaming(s);
      // Cached module-side: the brand and label pages reuse this one fetch.
      fetchTrend()
        .then(setTrend)
        .catch(() => {
          /* the trend is additive; never block the board on it */
        });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* Every post section reads a platform-filtered copy. The views carry
   * network and content_type already, so this is a slice of what was
   * fetched, not another request. */
  const filtered = platform !== "all";
  const fLeading = useMemo(
    () => (leading === null ? null : onPlatform(leading, platform)),
    [leading, platform],
  );
  const fRecent = useMemo(() => onPlatform(recent, platform), [recent, platform]);
  const fBest = useMemo(() => onPlatform(best, platform), [best, platform]);
  const fTopViews = useMemo(
    () => onPlatform(topViews, platform),
    [topViews, platform],
  );

  const latestArtists = useMemo(
    () => fRecent.filter((p) => p.brand_type === "artist"),
    [fRecent],
  );
  const latestThemes = useMemo(
    () => fRecent.filter((p) => p.brand_type === "theme"),
    [fRecent],
  );
  const bestArtists = useMemo(
    () => fBest.filter((p) => p.brand_type === "artist"),
    [fBest],
  );
  const bestThemes = useMemo(
    () => fBest.filter((p) => p.brand_type === "theme"),
    [fBest],
  );

  /**
   * All four figures come from data already fetched — no extra round trips.
   *
   * The first two are post-level (mx_leading) and follow the filter. Views and
   * accounts come from mx_account_scores, a brand-level rollup with no
   * platform split, so they cannot: they are rendered through RollupStat,
   * which greys them and says "all platforms" rather than passing an
   * unfiltered number off as a filtered one.
   */
  const kpis = useMemo(() => {
    const topMult = (fLeading ?? []).reduce<number | null>(
      (m, p) => (p.views_multiple != null && (m == null || p.views_multiple > m) ? p.views_multiple : m),
      null,
    );
    const views = scores.reduce((s, a) => s + (a.total_views ?? 0), 0);
    return {
      leadingCount: fLeading?.length ?? 0,
      topMult,
      views,
      accounts: scores.length,
    };
  }, [fLeading, scores]);

  const rowProps = { notes, interventions, streaming, openId, setOpenId, skipByBrand };
  const loaded = leading !== null;
  const windowLabel = period
    ? `${shortDate(period.period_start)} – ${shortDate(period.period_end)}`
    : `last 30 days`;
  const bestLabel = "last 6 months, 2.5× or better";

  return (
    <>
      <TopStripe />
      <AppBar
        current="board"
        onBrands={() => setAdminOpen(true)}
        onSignOut={MOCK ? undefined : () => supabase.auth.signOut()}
      />

      <div className="wrap">
        <div className="pagehead">
          <h1>{todayLabel()}</h1>
          <p className="sub">
            What&rsquo;s performing unusually well across the roster this
            morning. {MOCK && <b>Mock data.</b>}
          </p>
        </div>

        {error && (
          <div className="ratewarn">
            <h4>Could not load</h4>
            <p>{error}</p>
          </div>
        )}

        {!loaded && !error && <div className="empty">Loading&hellip;</div>}

        {loaded && (
          <>
            <PlatformFilter value={platform} onChange={setPlatform} />

            <div className="kpis">
              <div className="kpi">
                <div className="k">Above baseline</div>
                <div className="v">{kpis.leadingCount}</div>
                <div className="m">{windowLabel}</div>
              </div>
              <div className="kpi">
                <div className="k">Top multiple</div>
                <div className="v">{multiple(kpis.topMult)}</div>
                <div className="m">best post right now</div>
              </div>
              {/* mx_account_scores has no platform grain — see PlatformFilter. */}
              <RollupStat
                label="Views"
                value={compact(kpis.views)}
                meta={windowLabel}
                filtered={filtered}
              />
              <RollupStat
                label="Accounts scored"
                value={String(kpis.accounts)}
                meta="10+ posts of history"
                filtered={filtered}
              />
            </div>

            {labels.length > 0 && (
              <div className="card">
                <div className="eyebrow">
                  <span>Labels</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {labels.map((l) => (
                    <a
                      key={l.label_id}
                      href={labelPath(l.slug)}
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(labelPath(l.slug));
                      }}
                      className="btn"
                      style={{ textDecoration: "none" }}
                    >
                      {l.name}{" "}
                      <span className="num" style={{ color: "var(--muted)" }}>
                        {l.brands}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="card">
              <div className="eyebrow">
                <span>Explainers</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "center" }}>
                <button
                  className="lnk"
                  onClick={() => setExplainer((e) => (e === "score" ? null : "score"))}
                  aria-expanded={explainer === "score"}
                >
                  What does 3&times; mean?
                </button>
                <button
                  className="lnk"
                  onClick={() => setExplainer((e) => (e === "skip" ? null : "skip"))}
                  aria-expanded={explainer === "skip"}
                >
                  What is skip rate?
                </button>
              </div>
              {explainer === "score" && (
                <>
                  <hr className="r" />
                  <ScorePanel />
                </>
              )}
              {explainer === "skip" && (
                <>
                  <hr className="r" />
                  <SkipRatePanel roster={skipRoster} />
                </>
              )}
            </div>

            <Section
              id="leading"
              title="Leading"
              timescale={windowLabel}
              count={fLeading?.length ?? 0}
              defaultOpen
            >
              {!fLeading || fLeading.length === 0 ? (
                <Empty>
                  {filtered
                    ? "Nothing on this platform is beating its baseline this morning."
                    : "Nothing is beating its baseline this morning."}
                </Empty>
              ) : (
                <PostList listId="leading" posts={fLeading} canMark {...rowProps} reload={load} />
              )}
            </Section>

            <Section
              id="latest-artists"
              title="Latest artist posts"
              timescale="most recent"
              count={latestArtists.length}
            >
              {latestArtists.length === 0 ? (
                <Empty>Nothing here yet.</Empty>
              ) : (
                <PaginatedPostList listId="latest-artists" posts={latestArtists} variant="feed" canMark {...rowProps} reload={load} />
              )}
            </Section>

            <Section
              id="latest-themes"
              title="Latest theme account posts"
              timescale="most recent"
              count={latestThemes.length}
            >
              {latestThemes.length === 0 ? (
                <Empty>Nothing here yet.</Empty>
              ) : (
                <PaginatedPostList listId="latest-themes" posts={latestThemes} variant="feed" canMark {...rowProps} reload={load} />
              )}
            </Section>

            <Section
              id="best-artists"
              title="Best performing artist posts"
              timescale={bestLabel}
              count={bestArtists.length}
            >
              {bestArtists.length === 0 ? (
                <Empty>Nothing has beaten its baseline yet.</Empty>
              ) : (
                <PostList listId="best-artists" posts={bestArtists} {...rowProps} reload={load} />
              )}
            </Section>

            <Section
              id="best-themes"
              title="Best performing theme posts"
              timescale={bestLabel}
              count={bestThemes.length}
            >
              {bestThemes.length === 0 ? (
                <Empty>Nothing has beaten its baseline yet.</Empty>
              ) : (
                <PostList listId="best-themes" posts={bestThemes} {...rowProps} reload={load} />
              )}
            </Section>

            <Section
              id="most-viewed"
              title="Most viewed"
              timescale={windowLabel}
              count={fTopViews.length}
            >
              {fTopViews.length === 0 ? (
                <Empty>Nothing yet.</Empty>
              ) : (
                <PostList
                  listId="most-viewed"
                  posts={fTopViews}
                  variant="reach"
                  {...rowProps}
                  reload={load}
                />
              )}
            </Section>

            <Section
              id="leaderboard"
              title="Account leaderboard"
              // On the summary line as well as in the body: this section is
              // collapsed by default, and a row count sitting under a platform
              // filter must not read as filtered while the caveat is folded
              // away inside it.
              timescale={
                filtered ? `${windowLabel} · all platforms` : windowLabel
              }
              count={scores.length}
              subtitle="Each account's multiples added together over the period — so posting more good content scores higher than one lucky post. Reach and consistency, not a single spike."
            >
              <RollupNote filtered={filtered}>
                Account scores come from a brand-level rollup with no platform
                split, so this table is every platform whatever the filter
                says. Narrowing it would mean re-scoring per platform in the
                database, not slicing rows here.
              </RollupNote>
              {scores.length === 0 ? (
                <Empty>Nothing scored yet.</Empty>
              ) : (
                <div className="scroll">
                  <table className="t">
                    <thead>
                      <tr>
                        <th>Account</th>
                        <th>Posts</th>
                        <th>Avg multiple</th>
                        <th>Views</th>
                        <th>Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scores.map((a) => (
                        <tr key={a.brand_name}>
                          <td>
                            <a
                              href={brandPath(a.brand_name)}
                              onClick={(e) => {
                                e.preventDefault();
                                navigate(brandPath(a.brand_name));
                              }}
                              style={{ color: "inherit", fontWeight: 700 }}
                            >
                              {a.brand_name}
                            </a>
                            <span style={{ color: "var(--muted)", marginLeft: 8 }}>
                              {a.brand_type}
                            </span>
                            <LabelTags labels={a.labels} />
                          </td>
                          <td>{a.posts}</td>
                          <td>{a.avg_multiple.toFixed(1)}&times;</td>
                          <td>{compact(a.total_views)}</td>
                          <td style={{ fontWeight: 700 }}>
                            {a.total_score >= 100
                              ? Math.round(a.total_score)
                              : a.total_score.toFixed(1)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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

      {adminOpen && (
        <BrandAdmin
          brands={brands}
          labels={labels}
          onClose={() => setAdminOpen(false)}
          reload={load}
        />
      )}
    </>
  );
}

function ScorePanel() {
  return (
    <div className="note" style={{ maxWidth: "66ch" }}>
      <p style={{ marginTop: 0 }}>
        The multiple compares a post to what&rsquo;s normal for its own account.{" "}
        <b>3&times;</b> means three times the views of a typical post from that
        account, on that platform, in that format.
      </p>
      <p>
        Typical is the median of the account&rsquo;s recent posts — so a small
        account&rsquo;s breakout isn&rsquo;t buried under a big account&rsquo;s
        ordinary day. It measures unusualness, not quality: a <b>60&times;</b>{" "}
        post on a quiet account may still have fewer views than an ordinary post
        on a busy one.
      </p>
      <p style={{ marginBottom: 0 }}>
        Posts we&rsquo;ve paid to boost are excluded from the comparison, and an
        account needs at least ten posts of history before anything is scored.
      </p>
    </div>
  );
}

/**
 * PostList with a Load more control: PAGE_SIZE rows, growing by PAGE_SIZE
 * up to PAGE_MAX — used by the Latest feeds.
 */
function PaginatedPostList(props: Parameters<typeof PostList>[0]) {
  const [visible, setVisible] = useState(PAGE_SIZE);
  const cap = Math.min(props.posts.length, PAGE_MAX);
  const shown = props.posts.slice(0, Math.min(visible, cap));
  return (
    <>
      <PostList {...props} posts={shown} />
      {shown.length < cap && (
        <button
          className="btn"
          style={{ marginTop: 12 }}
          onClick={() => setVisible((v) => Math.min(v + PAGE_SIZE, cap))}
        >
          Load more ({cap - shown.length} more)
        </button>
      )}
    </>
  );
}

function PostList(props: {
  listId: string;
  posts: FlaggedPost[];
  notes: PostNote[];
  interventions: Intervention[];
  streaming: StreamingCapture[];
  openId: string | null;
  setOpenId: (id: string | null) => void;
  reload: () => Promise<void>;
  variant?: "score" | "feed" | "reach";
  skipByBrand?: Map<string, number | null>;
  /** Leading and Latest only — see PostRow. */
  canMark?: boolean;
}) {
  return (
    <div>
      {props.posts.map((p) => {
        // Scoped per section — the same post can appear in Leading, Latest
        // and Best, and expanding it in one shouldn't expand it everywhere.
        const rowId = `${props.listId}:${p.external_id}`;
        return (
          <PostRow
            key={p.external_id}
            post={p}
            variant={props.variant}
            canMark={props.canMark}
            medianSkip={props.skipByBrand?.get(p.brand_name) ?? null}
            notes={props.notes.filter((n) => n.external_id === p.external_id)}
            interventions={props.interventions.filter(
              (i) => i.external_id === p.external_id,
            )}
            streaming={props.streaming.filter(
              (s) => s.triggered_by_external_id === p.external_id,
            )}
            open={props.openId === rowId}
            onToggle={() =>
              props.setOpenId(props.openId === rowId ? null : rowId)
            }
            reload={props.reload}
          />
        );
      })}
    </div>
  );
}
