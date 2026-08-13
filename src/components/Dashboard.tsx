import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase, MOCK } from "../lib/supabase";
import {
  fetchAccountScores,
  fetchBest,
  fetchBrands,
  fetchLabels,
  fetchInterventions,
  fetchLeading,
  fetchNotes,
  fetchPeriod,
  fetchRecent,
  fetchStreaming,
  fetchTopViews,
} from "../lib/data";
import { compact, shortDate, todayLabel } from "../lib/format";
import type {
  AccountScore,
  Brand,
  Label,
  FlaggedPost,
  Intervention,
  Period,
  PostNote,
  StreamingCapture,
} from "../lib/types";
import PostRow from "./PostRow";
import BrandAdmin from "./BrandAdmin";
import { Section, Empty } from "./Section";
import { LabelTags } from "./BrandRow";
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
  const [error, setError] = useState<string | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

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
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const latestArtists = useMemo(
    () => recent.filter((p) => p.brand_type === "artist"),
    [recent],
  );
  const latestThemes = useMemo(
    () => recent.filter((p) => p.brand_type === "theme"),
    [recent],
  );
  const bestArtists = useMemo(
    () => best.filter((p) => p.brand_type === "artist"),
    [best],
  );
  const bestThemes = useMemo(
    () => best.filter((p) => p.brand_type === "theme"),
    [best],
  );

  const rowProps = { notes, interventions, streaming, openId, setOpenId };
  const loaded = leading !== null;
  const windowLabel = period
    ? `${shortDate(period.period_start)} \u2013 ${shortDate(period.period_end)}`
    : `last 30 days`;
  const bestLabel = "last 6 months, 2.5\u00d7 or better";

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 sm:px-10">
      <header className="mb-12">
        <div className="flex items-baseline justify-between">
          <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-dim">
            Dance to the Radio
            {MOCK && <span className="ml-3 text-accent">mock data</span>}
          </p>
          <nav className="flex gap-5 text-[13px] text-dim">
            <button className="hover:text-ink" onClick={() => setAdminOpen(true)}>
              Brands
            </button>
            {!MOCK && (
              <button
                className="hover:text-ink"
                onClick={() => supabase.auth.signOut()}
              >
                Sign out
              </button>
            )}
          </nav>
        </div>
        <h1 className="mt-3 font-serif text-4xl tracking-tight">
          {todayLabel()}
        </h1>
        {labels.length > 0 && (
          <nav className="mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-1">
            <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-dim">
              Labels
            </span>
            {labels.map((l) => (
              <a
                key={l.label_id}
                href={labelPath(l.slug)}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(labelPath(l.slug));
                }}
                className="text-sm text-dim hover:text-ink hover:underline"
              >
                {l.name}
                <span className="ml-1.5 text-xs text-dim/70">{l.brands}</span>
              </a>
            ))}
          </nav>
        )}
        <ScoreExplainer />
      </header>

      {error && <p className="mb-8 text-sm text-accent">{error}</p>}

      {!loaded && !error && (
        <p className="py-24 text-center text-sm text-dim">Loading…</p>
      )}

      {loaded && (
        <div className="space-y-12">
          <Section
            id="leading"
            title="Leading"
            timescale={windowLabel}
            count={leading?.length ?? 0}
            defaultOpen
          >
            {!leading || leading.length === 0 ? (
              <Empty>Nothing is beating its baseline this morning.</Empty>
            ) : (
              <PostList listId="leading" posts={leading} {...rowProps} reload={load} />
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
              <PaginatedPostList listId="latest-artists" posts={latestArtists} variant="feed" {...rowProps} reload={load} />
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
              <PaginatedPostList listId="latest-themes" posts={latestThemes} variant="feed" {...rowProps} reload={load} />
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
            count={topViews.length}
          >
            {topViews.length === 0 ? (
              <Empty>Nothing yet.</Empty>
            ) : (
              <PostList
                listId="most-viewed"
                posts={topViews}
                variant="reach"
                {...rowProps}
                reload={load}
              />
            )}
          </Section>

          <Section
            id="leaderboard"
            title="Account leaderboard"
            timescale={windowLabel}
            count={scores.length}
            subtitle="Each account's multiples added together over the period — so posting more good content scores higher than one lucky post. Reach and consistency, not a single spike."
          >
            {scores.length === 0 ? (
              <Empty>Nothing scored yet.</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {scores.map((a) => (
                  <li key={a.brand_name} className="flex items-center gap-4 py-4">
                    <span className="w-18 shrink-0 text-right font-serif text-[2rem] leading-none text-accent">
                      {a.total_score >= 100
                        ? Math.round(a.total_score)
                        : a.total_score.toFixed(1)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline gap-x-2">
                        <a
                          href={brandPath(a.brand_name)}
                          onClick={(e) => {
                            e.preventDefault();
                            navigate(brandPath(a.brand_name));
                          }}
                          className="text-[15px] font-semibold hover:underline"
                        >
                          {a.brand_name}
                        </a>
                        <span className="text-xs text-dim">{a.brand_type}</span>
                        <LabelTags labels={a.labels} />
                      </span>
                      <span className="mt-1 block text-[13px] text-dim">
                        {a.posts} post{a.posts === 1 ? "" : "s"} ·{" "}
                        {a.avg_multiple.toFixed(1)}× average ·{" "}
                        {compact(a.total_views)} views
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      )}

      {adminOpen && (
        <BrandAdmin
          brands={brands}
          labels={labels}
          onClose={() => setAdminOpen(false)}
          reload={load}
        />
      )}
    </div>
  );
}

function ScoreExplainer() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button
        className="text-[13px] text-dim underline underline-offset-2 hover:text-ink"
        onClick={() => setOpen((o) => !o)}
      >
        What does <span className="font-serif">3×</span> mean?
      </button>
      {open && (
        <div className="mt-3 max-w-prose space-y-2 text-sm leading-relaxed text-dim">
          <p>
            The multiple compares a post to what's normal for its own account.{" "}
            <span className="font-serif text-ink">3×</span> means three times
            the views of a typical post from that account, on that platform,
            in that format.
          </p>
          <p>
            Typical is the median of the account's recent posts — so a small
            account's breakout isn't buried under a big account's ordinary
            day. It measures unusualness, not quality: a{" "}
            <span className="font-serif text-ink">60×</span> post on a quiet
            account may still have fewer views than an ordinary post on a busy
            one.
          </p>
          <p>
            Posts we've paid to boost are excluded from the comparison, and an
            account needs at least ten posts of history before anything is
            scored.
          </p>
        </div>
      )}
    </div>
  );
}



/**
 * PostList with a Load more control: PAGE_SIZE rows, growing by PAGE_SIZE
 * up to PAGE_MAX — used by the Latest feeds.
 */
function PaginatedPostList(
  props: Parameters<typeof PostList>[0],
) {
  const [visible, setVisible] = useState(PAGE_SIZE);
  const cap = Math.min(props.posts.length, PAGE_MAX);
  const shown = props.posts.slice(0, Math.min(visible, cap));
  return (
    <>
      <PostList {...props} posts={shown} />
      {shown.length < cap && (
        <button
          className="mt-4 text-[13px] text-dim underline underline-offset-2 hover:text-ink"
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
}) {
  return (
    <ul className="divide-y divide-line">
      {props.posts.map((p) => {
        // Scoped per section — the same post can appear in Leading, Latest
        // and Best, and expanding it in one shouldn't expand it everywhere.
        const rowId = `${props.listId}:${p.external_id}`;
        return (
          <PostRow
            key={p.external_id}
            post={p}
            variant={props.variant}
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
    </ul>
  );
}
