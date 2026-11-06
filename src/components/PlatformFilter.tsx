import {
  PLATFORM_FILTER_OPTIONS,
  platformFilterLabel,
  type PlatformFilterKey,
} from "../lib/platforms";

/**
 * Page-level platform filter — INTERNAL PAGES ONLY (dashboard, brand pages,
 * label pages).
 *
 * One control at the top of the page narrows every section below it: Leading,
 * Latest, Best, Most viewed, the platform tables and the trend chart. The
 * filtering itself is client-side on data already fetched — every post-level
 * and platform-level view carries network and content_type — so changing the
 * selection costs no round trip and no loading state.
 *
 * Deliberately not rendered on /share/[token] or /share/label/[token]. Those
 * pages run as anon against a 3s statement timeout and are a fixed, dead-end
 * view of one account's figures; a control that silently changes what an
 * artist is looking at belongs to the internal read, not the shared one.
 * `src/__tests__/share-assist-isolation.test.tsx` asserts no share route
 * imports this module, the same way it guards the paid-marking control.
 *
 * ---------------------------------------------------------------------------
 * THE EXCEPTION, and why it is marked rather than quietly left wrong
 *
 * Two sources are brand-level rollups with no platform split at all:
 * mx_brand_summary (a brand's all-time and 3-month posts and views) and
 * mx_account_scores (the leaderboard), with mx_labels' brand counts in the
 * same position. Nothing client-side can narrow them — the platform grain is
 * not in the row.
 *
 * Those figures stay on screen, greyed, labelled "all platforms". The
 * alternative was hiding them under a selection, and marking won on three
 * counts: a figure that disappears teaches nothing about why, the dashboard
 * loses its whole leaderboard and a brand page its entire header exactly when
 * someone is comparing platforms, and a greyed number carrying its own
 * caveat cannot be misread as filtered — which is the only outcome that
 * actually mattered. RollupStat and RollupNote below are that treatment, and
 * every figure fed by those three sources must use one of them.
 */
export default function PlatformFilter({
  value,
  onChange,
}: {
  value: PlatformFilterKey;
  onChange: (key: PlatformFilterKey) => void;
}) {
  return (
    <div className="card">
      <div className="eyebrow">
        <span>Platform</span>
      </div>
      <div
        role="group"
        aria-label="Filter this page by platform"
        style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
      >
        {PLATFORM_FILTER_OPTIONS.map((o) => (
          <button
            key={o.key}
            className={`tab${value === o.key ? " on" : ""}`}
            aria-pressed={value === o.key}
            onClick={() => onChange(o.key)}
          >
            {o.label}
          </button>
        ))}
      </div>
      {value !== "all" && (
        <p className="note">
          Every section on this page covers{" "}
          <b>{platformFilterLabel(value)}</b> only. Figures marked{" "}
          <i>all platforms</i> come from brand-level rollups with no platform
          split, so they are unchanged — not filtered.
        </p>
      )}
    </div>
  );
}

/**
 * A KPI tile whose figure cannot honour the filter. Greyed and labelled while
 * a platform is selected; an ordinary tile otherwise.
 *
 * The tile's own meta is kept alongside the marker rather than replaced —
 * "all time · all platforms" says both things, and dropping the first to make
 * room for the second would trade one inaccuracy for another.
 */
export function RollupStat({
  value,
  label,
  meta,
  filtered,
}: {
  value: string;
  label: string;
  meta?: string;
  filtered: boolean;
}) {
  const foot = filtered ? [meta, "all platforms"].filter(Boolean).join(" · ") : meta;
  return (
    <div className="kpi">
      <div className="k">{label}</div>
      <div className="v" style={filtered ? { color: "var(--muted)" } : undefined}>
        {value}
      </div>
      {foot && <div className="m">{foot}</div>}
    </div>
  );
}

/**
 * The same caveat for a whole section — the leaderboard, where greying one
 * number would not do. Renders nothing while the filter is off.
 */
export function RollupNote({
  filtered,
  children,
}: {
  filtered: boolean;
  children: React.ReactNode;
}) {
  if (!filtered) return null;
  return (
    <p className="note" style={{ color: "var(--ink)" }}>
      <b>All platforms.</b> {children}
    </p>
  );
}
