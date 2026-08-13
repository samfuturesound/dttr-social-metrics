import { useState } from "react";
import type { SkipRoster } from "../lib/types";

/** Industry-wide aggregate band for a typical reel. Editorial constants —
 *  there's no published music-account benchmark, so these are stated as the
 *  broad figures they are. INDUSTRY_MEDIAN doubles as the "beating it" mark. */
export const INDUSTRY_LOW = 60;
export const INDUSTRY_HIGH = 65;
export const INDUSTRY_MEDIAN = INDUSTRY_LOW;

/** True when a reel beats the industry median (lower skip is better). */
export function beatsIndustry(skipRate: number | null | undefined): boolean {
  return skipRate !== null && skipRate !== undefined && skipRate < INDUSTRY_MEDIAN;
}

/**
 * Restrained marker for a reel that beat the industry median. A hairline
 * outline rather than a badge or colour block — it should read as a margin
 * note, not a rosette.
 */
export function SkipMarker({ skipRate }: { skipRate: number | null }) {
  if (!beatsIndustry(skipRate)) return null;
  return (
    <span
      title={`Beats the industry median of ${INDUSTRY_MEDIAN}%`}
      className="ml-1 rounded-full border border-dim/40 px-1.5 py-px text-[10px] uppercase tracking-wider text-ink"
    >
      strong hook
    </span>
  );
}

/**
 * The prose on its own, so a caller that groups several explainers into one
 * row can render the trigger and the panel separately — otherwise each
 * explainer traps its panel inside its own flex column.
 *
 * Internal only — the roster figures are comparative information the public
 * share pages must never carry. Those pages don't render skip rate at all.
 *
 * Roster numbers are read live from mx_skip_roster rather than hardcoded, so
 * the copy can't drift as new reels land.
 */
export function SkipRatePanel({ roster }: { roster: SkipRoster | null }) {
  return (
    <div className="max-w-prose space-y-2 text-sm leading-relaxed text-dim">
      <p>
        Skip rate is the share of viewers who scrolled past in the first
        three seconds. It measures the hook, and nothing else — a low skip
        rate means the opening earned attention, not that the video was
        good. Lower is better.
      </p>
      <p>
        There's no published benchmark for music accounts. Industry-wide,
        aggregate data puts a typical reel between {INDUSTRY_LOW}% and{" "}
        {INDUSTRY_HIGH}%.
        {roster && (
          <>
        {" "}
        Across our roster the median is{" "}
        <span className="text-ink">
          {Math.round(roster.roster_median)}%
        </span>
        , with the best reel at {Math.round(roster.best_skip_rate)}% and
        the worst at {Math.round(roster.worst_skip_rate)}%.
          </>
        )}
      </p>
      <p>
        Compare against the account's own median rather than a fixed target
        — audience and format shift it more than quality does.
      </p>
      <p>Instagram reels only. No other platform reports it.</p>
    </div>
  );
}

/** Standalone link + panel, used where the explainer stands on its own. */
export default function SkipRateExplainer({
  roster,
  className = "",
}: {
  roster: SkipRoster | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={className}>
      <button
        className="text-[13px] text-dim underline underline-offset-2 hover:text-ink"
        onClick={() => setOpen((o) => !o)}
      >
        What is skip rate?
      </button>
      {open && (
        <div className="mt-3">
          <SkipRatePanel roster={roster} />
        </div>
      )}
    </div>
  );
}
