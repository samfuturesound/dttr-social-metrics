import { useMemo, useState } from "react";
import { compact } from "../lib/format";
import { PLATFORMS } from "../lib/platforms";
import type { TrendRow } from "../lib/types";

/**
 * Monthly trend, used on the dashboard, brand pages, label pages and both
 * share routes. One component: the differences are which rows go in and
 * whether the artist selector renders, not a separate chart per route.
 *
 * Deliberate constraints, all of which have a reason:
 *
 *  - Platforms are never pooled. The medians aren't comparable across them,
 *    the same reason the platform tables are split.
 *  - Each ticked metric gets its own panel with its own axis. Two measures of
 *    different scale never share a y-axis.
 *  - A missing month breaks the line. No interpolation, no zero-fill, no
 *    dotted bridge — a gap means fewer than three organic posts, which is not
 *    the same as a bad month.
 *  - A month is plotted once it has ENDED. The youngest months have not
 *    finished accruing views, so they arrive flagged is_provisional and are
 *    drawn dashed, with the reason said in words under the chart. Drawing them
 *    like settled months would show a dip that isn't there; hiding them, which
 *    is what the old 30-day rule did, kept two months of real data invisible.
 *  - A series with a single month is still a series. It gets a deliberate,
 *    larger marker and a legend entry, because one small dot alone on an axis
 *    reads as a bug rather than as "this account has one month of data".
 *  - Every series is organic only. Paid posts are excluded upstream by the
 *    trend functions; paid_excluded is how many were left out, and it is
 *    reported in the tooltip rather than drawn as a line of its own.
 *  - Median views is log. On TikTok alone the range is 474 to 187,525; linear
 *    would flatten every account except the top one into the floor.
 */

/* Categorical palette — validated, not eyeballed. These eight hues pass the
 * lightness band, chroma floor, adjacent-pair CVD separation and normal-vision
 * floor against a white card surface (worst adjacent CVD ΔE 9.1, normal-vision
 * ΔE 19.6). Three of them sit below 3:1 contrast on white, which obliges a
 * non-colour route to the same numbers — that is what the Table view is for.
 *
 * Fixed order, never cycled: colour follows the account, so ticking one off
 * never repaints the others. */
const PALETTE = [
  "#2a78d6", // blue
  "#eb6834", // orange
  "#1baf7a", // aqua
  "#eda100", // yellow
  "#e87ba4", // magenta
  "#008300", // green
  "#4a3aa7", // violet
  "#e34948", // red
];
const MAX_SERIES = PALETTE.length;

type MetricKey = "median_views" | "median_engagement_rate" | "growth_multiple";

const METRICS: {
  key: MetricKey;
  label: string;
  log: boolean;
  refLine?: number;
  fmt: (n: number) => string;
}[] = [
  {
    key: "median_views",
    label: "Median organic views",
    log: true,
    fmt: (n) => compact(n),
  },
  {
    key: "median_engagement_rate",
    label: "Median organic engagement %",
    log: false,
    fmt: (n) => n.toFixed(1),
  },
  {
    key: "growth_multiple",
    label: "Organic growth score",
    log: false,
    refLine: 1,
    fmt: (n) => n.toFixed(2),
  },
];

const MONTH_LABEL = (iso: string) =>
  new Date(iso + (iso.length === 10 ? "T00:00:00" : "")).toLocaleDateString(
    "en-GB",
    { month: "short" },
  );

const MONTH_FULL = (iso: string) =>
  new Date(iso + (iso.length === 10 ? "T00:00:00" : "")).toLocaleDateString(
    "en-GB",
    { month: "long" },
  );

/** "October is" / "September and October are" — the settling line's subject. */
function settlingSubject(months: string[]): string {
  const names = months.map(MONTH_FULL);
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `${list} ${names.length === 1 ? "is" : "are"}`;
}

type Hover = {
  artist: string;
  month: string;
  value: string;
  posts: number;
  /** Paid posts kept out of this month's median. Rendered only when > 0. */
  paidExcluded: number;
  /** Month ended but still accruing views — the tooltip says so. */
  provisional: boolean;
  x: number;
  y: number;
  /** Width of the chart area, to keep the box on it. Carried on the hover
   *  because it is measured at the same moment as the point's position. */
  rootWidth: number;
} | null;

/** Caps the tooltip. Wide enough for the settling sentence on two or three
 *  lines, narrow enough to sit beside a point near either edge. */
const TIP_W = 230;

export default function TrendChart({
  rows,
  showArtistSelector,
  platformKey = null,
}: {
  rows: TrendRow[];
  /** Dashboard and label pages only. A brand page and both share routes are
   *  a single account, so there is nothing to select between. */
  showArtistSelector: boolean;
  /**
   * The page-level platform filter's selection, where the page has one.
   *
   * Non-null locks the chart to that platform and hides the chart's own
   * platform tabs: two controls for one choice is a trap, and the page control
   * is the one that also moves every other section. Null (share routes, and
   * internal pages set to All) leaves the chart its own tabs, because the
   * chart can never pool platforms even when the rest of the page does.
   */
  platformKey?: string | null;
}) {
  const [ownPlatform, setOwnPlatform] = useState<string>(PLATFORMS[0].key);
  const locked = platformKey != null;
  const platform = platformKey ?? ownPlatform;
  const [metrics, setMetrics] = useState<MetricKey[]>(["median_views"]);
  const [selByPlatform, setSelByPlatform] = useState<Record<string, string[]>>(
    {},
  );
  const [view, setView] = useState<"chart" | "table">("chart");
  const [hover, setHover] = useState<Hover>(null);

  /** The x-axis is every month in the payload, so it doesn't jump when the
   *  platform changes and a quiet month drops out. */
  const months = useMemo(
    () => [...new Set(rows.map((r) => r.month))].sort(),
    [rows],
  );

  const platformRows = useMemo(
    () => rows.filter((r) => `${r.network}|${r.content_type}` === platform),
    [rows, platform],
  );

  /** Accounts ordered by volume on this platform. That order is the colour
   *  assignment, so it must not depend on what is ticked. */
  const artists = useMemo(() => {
    const posts = new Map<string, number>();
    for (const r of platformRows)
      posts.set(r.brand_name, (posts.get(r.brand_name) ?? 0) + r.posts);
    return [...posts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name, n], i) => ({
        name,
        posts: n,
        colour: PALETTE[i] ?? null,
        slot: i,
      }));
  }, [platformRows]);

  const selected = useMemo(() => {
    const stored = selByPlatform[platform];
    if (stored) return stored;
    // Default: the five with the most posts in the window.
    return artists.slice(0, 5).map((a) => a.name);
  }, [selByPlatform, platform, artists]);

  const visible = useMemo(
    () => artists.filter((a) => selected.includes(a.name) && a.colour),
    [artists, selected],
  );

  /** How many months each visible account has on this platform. One is the
   *  case the chart has to treat deliberately rather than leave to a 4px dot;
   *  it also decides whether the legend is needed on a single-account route. */
  const monthsPerSeries = useMemo(() => {
    const names = new Set(visible.map((v) => v.name));
    const m = new Map<string, Set<string>>();
    for (const r of platformRows) {
      if (!names.has(r.brand_name)) continue;
      const set = m.get(r.brand_name) ?? new Set<string>();
      set.add(r.month);
      m.set(r.brand_name, set);
    }
    return new Map([...m].map(([name, set]) => [name, set.size]));
  }, [platformRows, visible]);

  const hasSinglePointSeries = useMemo(
    () => [...monthsPerSeries.values()].some((n) => n === 1),
    [monthsPerSeries],
  );

  /** Which months are still settling. A property of the calendar, so taken
   *  from the whole payload rather than per platform. */
  const provisionalMonths = useMemo(
    () => new Set(rows.filter((r) => r.is_provisional).map((r) => r.month)),
    [rows],
  );

  /** Provisional months actually drawn: this platform, these accounts. The
   *  settling line is a caption for what is on screen, not for the payload. */
  const settlingMonths = useMemo(() => {
    const names = new Set(visible.map((v) => v.name));
    return [
      ...new Set(
        platformRows
          .filter((r) => r.is_provisional && names.has(r.brand_name))
          .map((r) => r.month),
      ),
    ].sort();
  }, [platformRows, visible]);

  function toggleArtist(name: string) {
    const next = selected.includes(name)
      ? selected.filter((n) => n !== name)
      : [...selected, name];
    if (next.length === 0) return; // never leave the chart empty
    setSelByPlatform((s) => ({ ...s, [platform]: next }));
  }

  function toggleMetric(key: MetricKey) {
    setMetrics((m) => {
      const next = m.includes(key) ? m.filter((k) => k !== key) : [...m, key];
      return next.length === 0 ? m : next; // at least one always on
    });
  }

  if (rows.length === 0) return null;

  const activeMetrics = METRICS.filter((m) => metrics.includes(m.key));
  const platformName =
    PLATFORMS.find((p) => p.key === platform)?.label ?? platform;

  return (
    <div className="card">
      <div className="eyebrow">
        {/* Locked, the platform tabs are gone, so the heading has to carry
            what is being shown — otherwise the panels name a metric and
            nothing on the card names the platform. */}
        <span>Monthly trend{locked ? ` · ${platformName}` : ""}</span>
        <button
          className="btn x"
          onClick={() => setView((v) => (v === "chart" ? "table" : "chart"))}
        >
          {view === "chart" ? "Table" : "Chart"}
        </button>
      </div>

      {/* 1 — platform. Single select; pooling them would be a lie. Folded
          into the page-level filter when the page has one set. */}
      {!locked && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {PLATFORMS.map((p) => (
            <button
              key={p.key}
              className={`tab${platform === p.key ? " on" : ""}`}
              onClick={() => setOwnPlatform(p.key)}
              aria-pressed={platform === p.key}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {/* 2 — metrics. Multi-select, one panel each. */}
      <div className="lab-mono" style={{ marginBottom: 6 }}>
        Metrics
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
        {METRICS.map((m) => (
          <label
            key={m.key}
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}
          >
            <input
              type="checkbox"
              checked={metrics.includes(m.key)}
              onChange={() => toggleMetric(m.key)}
            />
            {m.label}
          </label>
        ))}
      </div>

      {/* 3 — artists. Doubles as the legend where it renders. */}
      {showArtistSelector && artists.length > 1 && (
        <>
          <div className="lab-mono" style={{ marginBottom: 6 }}>
            Accounts
          </div>
          <div
            style={{ display: "flex", gap: "6px 16px", flexWrap: "wrap", marginBottom: 14 }}
          >
            {artists.map((a) => {
              const on = selected.includes(a.name);
              const capped = !a.colour;
              return (
                <label
                  key={a.name}
                  title={
                    capped
                      ? `Beyond the ${MAX_SERIES}-series colour limit`
                      : `${a.posts} posts`
                  }
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 13,
                    opacity: capped ? 0.4 : 1,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={on && !capped}
                    disabled={capped}
                    onChange={() => toggleArtist(a.name)}
                  />
                  <span
                    aria-hidden
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 3,
                      flexShrink: 0,
                      background: a.colour ?? "var(--line)",
                      border: "2px solid var(--ink)",
                    }}
                  />
                  {a.name}
                </label>
              );
            })}
          </div>
          {artists.length > MAX_SERIES && (
            <p className="note" style={{ marginTop: -6 }}>
              {artists.length - MAX_SERIES} account
              {artists.length - MAX_SERIES === 1 ? "" : "s"} beyond the{" "}
              {MAX_SERIES}-series limit aren&rsquo;t shown — past eight, colours
              stop being reliably distinguishable.
            </p>
          )}
        </>
      )}

      {/* Legend for routes with no selector. Needed whenever more than one
          account is drawn — identity must never be carried by colour alone —
          and also for a lone single-month series, where naming the account is
          what makes one dot legible as that account's only month. */}
      {!showArtistSelector && (visible.length > 1 || hasSinglePointSeries) && (
        <div style={{ display: "flex", gap: "6px 16px", flexWrap: "wrap", marginBottom: 14 }}>
          {visible.map((a) => (
            <span
              key={a.name}
              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}
            >
              <span
                aria-hidden
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  background: a.colour!,
                  border: "2px solid var(--ink)",
                }}
              />
              {a.name}
              {monthsPerSeries.get(a.name) === 1 && (
                <span style={{ color: "var(--muted)" }}>· one month</span>
              )}
            </span>
          ))}
        </div>
      )}

      {view === "chart" ? (
        <div
          data-trend-root
          style={{ position: "relative" }}
          onMouseLeave={() => setHover(null)}
        >
          {activeMetrics.map((m) => (
            <Panel
              key={m.key}
              metric={m}
              months={months}
              rows={platformRows}
              series={visible}
              provisionalMonths={provisionalMonths}
              onHover={setHover}
            />
          ))}
          {hover && (
            <div
              style={{
                position: "absolute",
                // Clamped at both edges. Without the right-hand clamp the
                // last month's box is pinned against the container and its
                // shrink-to-fit width collapses to a few characters.
                left: Math.min(
                  Math.max(0, hover.x - 70),
                  Math.max(0, hover.rootWidth - TIP_W),
                ),
                // Anchored by its own bottom edge rather than a measured
                // offset, so the settling line can make the box taller
                // without pushing it down over the point it describes.
                top: hover.y - 10,
                transform: "translateY(-100%)",
                // max-content rather than shrink-to-fit: the available width
                // at this position must not decide how the sentence wraps.
                width: "max-content",
                maxWidth: TIP_W,
                pointerEvents: "none",
                background: "var(--card)",
                border: "2px solid var(--ink)",
                borderRadius: "var(--r-ctl)",
                padding: "6px 8px",
                fontSize: 12,
                whiteSpace: "nowrap",
                zIndex: 2,
              }}
            >
              <b>{hover.artist}</b>
              <br />
              {MONTH_LABEL(hover.month)} · <span className="num">{hover.value}</span>
              <br />
              <span style={{ color: "var(--muted)" }}>
                {hover.posts} post{hover.posts === 1 ? "" : "s"}
              </span>
              {hover.paidExcluded > 0 && (
                <>
                  <br />
                  <span style={{ color: "var(--muted)" }}>
                    {hover.paidExcluded} paid post
                    {hover.paidExcluded === 1 ? "" : "s"} excluded
                  </span>
                </>
              )}
              {hover.provisional && (
                // Wraps, unlike the figures above it — a nowrap sentence
                // this long would run the tooltip off the card.
                <div
                  style={{
                    marginTop: 4,
                    whiteSpace: "normal",
                    lineHeight: 1.35,
                  }}
                >
                  Still settling — views are accumulating and this will rise.
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        activeMetrics.map((m) => (
          <TrendTable
            key={m.key}
            metric={m}
            months={months}
            rows={platformRows}
            series={visible}
            provisionalMonths={provisionalMonths}
          />
        ))
      )}

      {/* The plain-words version of the dashed treatment. Ink, not muted:
          it is a caveat about what the chart is showing, not a footnote. */}
      {settlingMonths.length > 0 && (
        <p className="note" style={{ color: "var(--ink)" }}>
          {settlingSubject(settlingMonths)} still settling and will rise over
          the next few weeks.
        </p>
      )}

      <p className="note">
        Organic medians for posts published in each month, by platform. Paid
        posts are excluded. A month appears once it has ended and carries at
        least three organic posts — gaps are low-volume months, not zeros.
        Dashed points, and the segments leading to them, are months that ended
        less than 30 days ago: their views are still accumulating, so those
        medians will rise.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ panel */

const W = 1000;
const H = 190;
const M = { top: 14, right: 14, bottom: 26, left: 58 };

function Panel({
  metric,
  months,
  rows,
  series,
  provisionalMonths,
  onHover,
}: {
  metric: (typeof METRICS)[number];
  months: string[];
  rows: TrendRow[];
  series: { name: string; colour: string | null }[];
  provisionalMonths: Set<string>;
  onHover: (h: Hover) => void;
}) {
  const byKey = useMemo(() => {
    const m = new Map<string, TrendRow>();
    for (const r of rows) m.set(`${r.brand_name}|${r.month}`, r);
    return m;
  }, [rows]);

  const values: number[] = [];
  for (const s of series)
    for (const mo of months) {
      const v = byKey.get(`${s.name}|${mo}`)?.[metric.key];
      if (v != null) values.push(Number(v));
    }
  if (metric.refLine != null) values.push(metric.refLine);

  if (values.length === 0) {
    return (
      <div className="empty" style={{ marginBottom: 12 }}>
        No {metric.label.toLowerCase()} on this platform for the selected
        accounts.
      </div>
    );
  }

  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const project = makeScale(lo, hi, metric.log);

  const x = (i: number) =>
    M.left +
    (months.length === 1
      ? (W - M.left - M.right) / 2
      : (i * (W - M.left - M.right)) / (months.length - 1));
  const y = (v: number) => M.top + (1 - project.norm(v)) * (H - M.top - M.bottom);

  return (
    <div style={{ marginBottom: 14 }}>
      <div className="lab-mono" style={{ marginBottom: 4 }}>
        {metric.label}
        {metric.log && (
          <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
            {" "}
            · log scale
          </span>
        )}
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ display: "block", overflow: "visible" }}
        role="img"
        aria-label={`${metric.label} by month`}
      >
        {/* grid + y labels — recessive */}
        {project.ticks.map((t) => (
          <g key={t}>
            <line
              x1={M.left}
              x2={W - M.right}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--line)"
              strokeWidth={1}
            />
            <text
              x={M.left - 8}
              y={y(t) + 4}
              textAnchor="end"
              fontSize={11}
              fill="var(--muted)"
            >
              {metric.fmt(t)}
            </text>
          </g>
        ))}

        {/* reference line at 1.0 — flat, not growth */}
        {metric.refLine != null && (
          <line
            x1={M.left}
            x2={W - M.right}
            y1={y(metric.refLine)}
            y2={y(metric.refLine)}
            stroke="var(--ink)"
            strokeWidth={2}
            strokeDasharray="6 4"
          />
        )}

        {/* x labels. A settling month says so on the axis too, so the dashes
            are not the only cue — the same reason the Table view marks it. */}
        {months.map((mo, i) => (
          <text
            key={mo}
            x={x(i)}
            y={H - 8}
            textAnchor="middle"
            fontSize={11}
            fill="var(--muted)"
          >
            {MONTH_LABEL(mo)}
            {provisionalMonths.has(mo) && (
              <tspan fontSize={9} dy={0}>
                {" "}
                settling
              </tspan>
            )}
          </text>
        ))}

        {/* one line per account, broken wherever a month is missing */}
        {series.map((s) => {
          const pts = months.map((mo, i) => {
            const row = byKey.get(`${s.name}|${mo}`);
            const v = row?.[metric.key];
            return v == null
              ? null
              : {
                  i,
                  v: Number(v),
                  posts: row!.posts,
                  paidExcluded: row!.paid_excluded,
                  provisional: row!.is_provisional,
                  month: mo,
                };
          });
          const runs: {
            i: number;
            v: number;
            posts: number;
            paidExcluded: number;
            provisional: boolean;
            month: string;
          }[][] = [];
          let run: typeof runs[number] = [];
          for (const p of pts) {
            if (p) run.push(p);
            else if (run.length) {
              runs.push(run);
              run = [];
            }
          }
          if (run.length) runs.push(run);

          const points = runs.flat();
          /** One month in this panel. Drawn as a deliberate marker rather
           *  than the ordinary 4px dot, which alone on a six-month axis is
           *  indistinguishable from a rendering fault. */
          const lone = points.length === 1;

          return (
            <g key={s.name}>
              {/* Segment by segment rather than one polyline per run: a
                  segment is dashed when the month it ARRIVES at is still
                  settling, which a single polyline cannot express. */}
              {runs.map((r, ri) =>
                r.slice(1).map((p, k) => (
                  <line
                    key={`${ri}-${k}`}
                    x1={x(r[k].i)}
                    y1={y(r[k].v)}
                    x2={x(p.i)}
                    y2={y(p.v)}
                    stroke={s.colour!}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeDasharray={p.provisional ? "7 5" : undefined}
                  />
                )),
              )}
              {points.map((p) => (
                <g key={p.month}>
                  {/* Provisional: a dashed ring in the series colour around a
                      marker that stays filled. Hollowing the marker instead
                      would make a lone settling point read as an outline
                      artefact rather than as this account's latest month. */}
                  {p.provisional && (
                    <circle
                      cx={x(p.i)}
                      cy={y(p.v)}
                      r={lone ? 10 : 8}
                      fill="none"
                      stroke={s.colour!}
                      strokeWidth={2}
                      strokeDasharray="3 3"
                      pointerEvents="none"
                    />
                  )}
                  <circle
                    cx={x(p.i)}
                    cy={y(p.v)}
                    r={lone ? 6 : 4}
                    fill={s.colour!}
                    stroke="var(--card)"
                    strokeWidth={2}
                    style={{ cursor: "pointer" }}
                    onFocus={() => undefined}
                    tabIndex={-1}
                    onMouseOver={(e) => {
                      // Position from real client rects rather than
                      // re-deriving the viewBox scale — the SVG is fluid.
                      const dot = e.currentTarget.getBoundingClientRect();
                      const root = e.currentTarget
                        .closest("[data-trend-root]")
                        ?.getBoundingClientRect();
                      if (!root) return;
                      onHover({
                        artist: s.name,
                        month: p.month,
                        value: metric.fmt(p.v),
                        posts: p.posts,
                        paidExcluded: p.paidExcluded,
                        provisional: p.provisional,
                        x: dot.left - root.left + dot.width / 2,
                        y: dot.top - root.top,
                        rootWidth: root.width,
                      });
                    }}
                  />
                </g>
              ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/**
 * Log or linear scale with readable ticks.
 *
 * The log domain is the data's own range with a little headroom, not whole
 * decades. Snapping out to decades pins a series that lives between 1,000 and
 * 1,500 to the bottom eighth of the panel and throws away the detail the chart
 * exists to show. Ticks are the 1/2/5 steps that fall inside that range.
 */
function makeScale(lo: number, hi: number, log: boolean) {
  if (log) {
    const a = Math.log10(Math.max(lo, 1));
    const b = Math.log10(Math.max(hi, 10));
    const span = Math.max(b - a, 0.3);
    const l0 = a - span * 0.08;
    const l1 = b + span * 0.08;
    let ticks: number[] = [];
    for (let d = Math.floor(l0); d <= Math.ceil(l1); d++)
      for (const mult of [1, 2, 5]) {
        const t = mult * 10 ** d;
        const lt = Math.log10(t);
        if (lt >= l0 && lt <= l1) ticks.push(t);
      }
    // A narrow range can contain fewer than two 1/2/5 steps. Fall back to the
    // data's own bounds rather than adding raw domain endpoints, which land a
    // pixel from the surviving step and render as a collided pair.
    //
    // A single-point series is the degenerate case of that: lo === hi, so the
    // fallback would draw the same tick and the same label twice, one exactly
    // on top of the other. One tick is correct there — the panel is showing
    // one value, and there is no range to label.
    if (ticks.length < 2) ticks = lo === hi ? [lo] : [lo, hi];
    ticks = ticks.map((t) => (t >= 100 ? Math.round(t) : Math.round(t * 10) / 10));
    return {
      ticks,
      norm: (v: number) =>
        (Math.log10(Math.max(v, 1)) - l0) / Math.max(l1 - l0, 1e-9),
    };
  }
  const pad = (hi - lo) * 0.12 || Math.abs(hi) * 0.12 || 1;
  const a = lo - pad;
  const b = hi + pad;
  const ticks = [a, a + (b - a) / 2, b];
  return { ticks, norm: (v: number) => (v - a) / Math.max(b - a, 1e-9) };
}

/* ------------------------------------------------------------------ table */

/** The non-colour route to the same numbers. Three palette slots sit below
 *  3:1 contrast on white, which obliges this to exist. */
function TrendTable({
  metric,
  months,
  rows,
  series,
  provisionalMonths,
}: {
  metric: (typeof METRICS)[number];
  months: string[];
  rows: TrendRow[];
  series: { name: string; colour: string | null }[];
  /** Marked in the header, because dashes are a chart-only cue and this view
   *  exists precisely for people the chart does not serve. */
  provisionalMonths: Set<string>;
}) {
  const byKey = new Map<string, TrendRow>();
  for (const r of rows) byKey.set(`${r.brand_name}|${r.month}`, r);
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="lab-mono" style={{ marginBottom: 4 }}>
        {metric.label}
      </div>
      <div className="scroll">
        <table className="t">
          <thead>
            <tr>
              <th>Account</th>
              {months.map((m) => (
                <th key={m}>
                  {MONTH_LABEL(m)}
                  {provisionalMonths.has(m) && (
                    <span
                      style={{
                        display: "block",
                        fontWeight: 400,
                        textTransform: "none",
                        letterSpacing: 0,
                      }}
                    >
                      settling
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {series.map((s) => (
              <tr key={s.name}>
                <td>{s.name}</td>
                {months.map((mo) => {
                  const v = byKey.get(`${s.name}|${mo}`)?.[metric.key];
                  return (
                    <td key={mo}>
                      {v == null ? (
                        <span style={{ color: "var(--muted)" }}>—</span>
                      ) : (
                        metric.fmt(Number(v))
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
