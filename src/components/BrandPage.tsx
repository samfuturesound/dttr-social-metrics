import { useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchBrandSummary, fetchPostDetail } from "../lib/data";
import { age, compact, monthYear, multiple, shortDate } from "../lib/format";
import { navigate } from "../lib/router";
import type { BrandSummary, PostDetail } from "../lib/types";
import { Section, Empty } from "./Section";
import { Thumb } from "./PostRow";

const QUARTER_DAYS = 92;
const PAGE_SIZE = 10;
const PAGE_MAX = 50;

const NETWORK_LABEL: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  facebook: "Facebook",
};

/**
 * One row on a brand page. Every row is the same brand, so the caption is
 * the primary line. The design constraint for these pages: figures are only
 * ever shown next to the account's OWN median — never against a fixed
 * threshold or a roster-wide scale.
 */
function BrandRow(props: {
  post: PostDetail;
  headline?: string;
  right?: string;
  meta: string;
}) {
  const { post } = props;
  const title =
    post.caption?.trim() ||
    `${NETWORK_LABEL[post.network] ?? post.network} ${post.content_type}`;
  return (
    <li className="flex w-full items-center gap-4 py-4">
      <Thumb url={post.thumbnail_url} />
      {props.headline !== undefined && (
        <span
          className={
            post.is_assisted
              ? "w-18 shrink-0 text-right font-serif text-xl text-dim"
              : "w-18 shrink-0 text-right font-serif text-[1.75rem] leading-none text-accent"
          }
        >
          {props.headline}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="block truncate text-sm">{title}</span>
          <span className="text-xs text-dim">
            {NETWORK_LABEL[post.network] ?? post.network}
          </span>
          {post.is_assisted && post.assisted_from && (
            <span className="text-xs italic text-dim">
              assisted from {shortDate(post.assisted_from)}
            </span>
          )}
        </span>
        <span className="mt-1 block text-[13px] text-dim">{props.meta}</span>
      </span>
      {props.right !== undefined && (
        <span className="shrink-0 self-center font-serif text-base text-dim">
          {props.right}
        </span>
      )}
      {post.permalink && (
        <a
          href={post.permalink}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 self-center p-1 text-dim/70 hover:text-ink"
          title="Open post"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </a>
      )}
    </li>
  );
}

function Stat(props: { value: string; label: string }) {
  return (
    <div>
      <div className="font-serif text-2xl leading-tight">{props.value}</div>
      <div className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.15em] text-dim">
        {props.label}
      </div>
    </div>
  );
}

function EngagementExplainer() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        className="text-[13px] text-dim underline underline-offset-2 hover:text-ink"
        onClick={() => setOpen((o) => !o)}
      >
        What does the engagement score mean?
      </button>
      {open && (
        <div className="mt-3 max-w-prose space-y-2 text-sm leading-relaxed text-dim">
          <p>
            The engagement score weights actions by what they're worth. A like
            costs nothing. A comment takes effort. A save means someone
            intends to come back. A share puts that person's own audience
            behind the post. A follow is the strongest thing a single post can
            do.
          </p>
          <p>
            So they're weighted: like 1, comment 3, save 5, share 5, follow
            10. The total is divided by views, giving a score per 100 views —
            that way a small account with a devoted audience isn't beaten by a
            big account nobody responds to.
          </p>
          <p>
            It's a score, not a percentage.{" "}
            <span className="font-serif text-ink">9.2</span> doesn't mean 9.2%
            of viewers engaged; it means the weighted actions came to 9.2 per
            100 views. Compare it to the account's own median, shown
            alongside.
          </p>
          <p>
            Watch-through is separate: average watch time as a share of the
            video's length. Only video posts carry duration, so it's blank
            elsewhere.
          </p>
        </div>
      )}
    </div>
  );
}

export default function BrandPage({ brand }: { brand: string }) {
  const [posts, setPosts] = useState<PostDetail[] | null>(null);
  const [summary, setSummary] = useState<BrandSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [latestVisible, setLatestVisible] = useState(PAGE_SIZE);

  useEffect(() => {
    window.scrollTo(0, 0);
    setPosts(null);
    setSummary(null);
    setLatestVisible(PAGE_SIZE);
    Promise.all([fetchPostDetail(brand), fetchBrandSummary(brand)])
      .then(([p, s]) => {
        setPosts(p);
        setSummary(s);
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
  const topEngRate = useMemo(
    () =>
      (posts ?? [])
        .filter((p) => p.engagement_rate !== null)
        .sort((a, b) => (b.engagement_rate ?? 0) - (a.engagement_rate ?? 0))
        .slice(0, 5),
    [posts],
  );
  const mostWatched = useMemo(
    () =>
      (posts ?? [])
        .filter((p) => p.completion_pct !== null)
        .sort((a, b) => (b.completion_pct ?? 0) - (a.completion_pct ?? 0))
        .slice(0, 5),
    [posts],
  );

  const medViews = summary?.median_views ?? null;
  const medEng = summary?.median_engagement_rate ?? null;
  const medComp = summary?.median_completion_pct ?? null;

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
              {medViews !== null && (
                <Stat value={compact(medViews)} label="Median views" />
              )}
              {medEng !== null && (
                <Stat value={medEng.toFixed(1)} label="Median engagement" />
              )}
              {medComp !== null && (
                <Stat
                  value={`${Math.round(medComp)}%`}
                  label="Median completion"
                />
              )}
              {summary.first_post && summary.last_post && (
                <Stat
                  value={`${monthYear(summary.first_post)} – ${monthYear(summary.last_post)}`}
                  label="First – last post"
                />
              )}
            </div>
            <p className="mt-4 max-w-prose text-[13px] leading-relaxed text-dim">
              "All time" here means since measurements began — roughly the
              last twelve months — not the account's whole life.
            </p>
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
                    meta={`${shortDate(p.published_at)} · ${p.engagement_rate?.toFixed(1)} per 100 views${medEng !== null ? ` vs ${medEng.toFixed(1)} median` : ""}`}
                  />
                ))}
              </ul>
            )}
          </Section>

          <Section
            id="brand-top-eng"
            title="Top engagement rate"
            timescale="all time"
            count={topEngRate.length}
            subtitle="Highest weighted engagement per 100 views."
          >
            {topEngRate.length === 0 ? (
              <Empty>No engagement data yet.</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {topEngRate.map((p) => (
                  <BrandRow
                    key={p.external_id}
                    post={p}
                    headline={p.engagement_rate?.toFixed(1) ?? "—"}
                    meta={`${shortDate(p.published_at)} · ${compact(p.views)} views${medEng !== null ? ` · account median ${medEng.toFixed(1)}` : ""}`}
                  />
                ))}
              </ul>
            )}
          </Section>

          <Section
            id="brand-watched"
            title="Most watched through"
            timescale="all time"
            count={mostWatched.length}
            subtitle="Average watch time as a share of video length. Video posts only."
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
                    meta={`${shortDate(p.published_at)} · ${p.avg_watch_seconds?.toFixed(1) ?? "?"}s of ${p.duration_seconds ?? "?"}s${medComp !== null ? ` · account median ${Math.round(medComp)}%` : ""}`}
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
