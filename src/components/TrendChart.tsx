import { useMemo, useState } from "react";
import { compact } from "../lib/format";
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
 *    dotted bridge — a gap means fewer than three settled organic posts, which
 *    is not the same as a bad month.
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

const PLATFORMS = [
  { key: "tiktok|posts", label: "TikTok" },
  { key: "instagram|posts", label: "Instagram posts" },
  { key: "instagram|reels", label: "Instagram reels" },
] as const;

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

type Hover = {
  artist: string;
  month: string;
  value: string;
  posts: number;
  /** Paid posts kept out of this month's median. Rendered only when > 0. */
  paidExcluded: number;
  x: number;
  y: number;
} | null;

export default function TrendChart({
  rows,
  showArtistSelector,
}: {
  rows: TrendRow[];
  /** Dashboard and label pages only. A brand page and both share routes are
   *  a single account, so there is nothing to select between. */
  showArtistSelector: boolean;
}) {
  const [platform, setPlatform] = useState<string>(PLATFORMS[0].key);
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

  return (
    <div className="card">
      <div className="eyebrow">
        <span>Monthly trend</span>
        <button
          className="btn x"
          onClick={() => setView((v) => (v === "chart" ? "table" : "chart"))}
        >
          {view === "chart" ? "Table" : "Chart"}
        </button>
      </div>

      {/* 1 — platform. Single select; pooling them would be a lie. */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {PLATFORMS.map((p) => (
          <button
            key={p.key}
            className={`tab${platform === p.key ? " on" : ""}`}
            onClick={() => setPlatform(p.key)}
            aria-pressed={platform === p.key}
          >
            {p.label}
          </button>
        ))}
      </div>

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

      {/* Legend for routes with no selector but more than one account —
          identity must never be carried by colour alone. */}
      {!showArtistSelector && visible.length > 1 && (
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
              onHover={setHover}
            />
          ))}
          {hover && (
            <div
              style={{
                position: "absolute",
                left: Math.max(0, hover.x - 70),
                top: hover.y - 62,
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
          />
        ))
      )}

      <p className="note">
        Organic medians for posts published in each month, by platform. Paid
        posts are excluded. A month appears once it has settled for 30 days and
        carries at least three organic posts — gaps are low-volume months, not
        zeros.
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
  onHover,
}: {
  metric: (typeof METRICS)[number];
  months: string[];
  rows: TrendRow[];
  series: { name: string; colour: string | null }[];
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

        {/* x labels */}
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
                  month: mo,
                };
          });
          const runs: {
            i: number;
            v: number;
            posts: number;
            paidExcluded: number;
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

          return (
            <g key={s.name}>
              {runs
                .filter((r) => r.length > 1)
                .map((r, ri) => (
                  <polyline
                    key={ri}
                    fill="none"
                    stroke={s.colour!}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    points={r.map((p) => `${x(p.i)},${y(p.v)}`).join(" ")}
                  />
                ))}
              {runs.flat().map((p) => (
                <circle
                  key={p.month}
                  cx={x(p.i)}
                  cy={y(p.v)}
                  r={4}
                  fill={s.colour!}
                  stroke="var(--card)"
                  strokeWidth={2}
                  style={{ cursor: "pointer" }}
                  onFocus={() => undefined}
                  tabIndex={-1}
                  onMouseOver={(e) => {
                    // Position from real client rects rather than re-deriving
                    // the viewBox scale — the SVG is fluid width.
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
                      x: dot.left - root.left + dot.width / 2,
                      y: dot.top - root.top,
                    });
                  }}
                />
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
    if (ticks.length < 2) ticks = [lo, hi];
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
}: {
  metric: (typeof METRICS)[number];
  months: string[];
  rows: TrendRow[];
  series: { name: string; colour: string | null }[];
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
                <th key={m}>{MONTH_LABEL(m)}</th>
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
