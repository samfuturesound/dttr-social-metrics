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
 * Restrained marker for a reel that beat the industry median. In this system
 * that's a bordered pill rather than a coloured badge.
 */
export function SkipMarker({ skipRate }: { skipRate: number | null }) {
  if (!beatsIndustry(skipRate)) return null;
  return (
    <>
      {" "}
      <span
        className="pill good"
        title={`Beats the industry median of ${INDUSTRY_MEDIAN}%`}
      >
        strong hook
      </span>
    </>
  );
}

/**
 * The prose on its own, so a caller that groups several explainers into one
 * row can render the trigger and the panel separately.
 *
 * Internal only — the roster figures are comparative information the public
 * share pages must never carry. Those pages don't render skip rate at all.
 *
 * Roster numbers are read live from mx_skip_roster rather than hardcoded, so
 * the copy can't drift as new reels land.
 */
export function SkipRatePanel({ roster }: { roster: SkipRoster | null }) {
  return (
    <div className="note" style={{ maxWidth: "66ch" }}>
      <p style={{ marginTop: 0 }}>
        Skip rate is the share of viewers who scrolled past in the first three
        seconds. It measures the hook, and nothing else — a low skip rate means
        the opening earned attention, not that the video was good. Lower is
        better.
      </p>
      <p>
        There&rsquo;s no published benchmark for music accounts. Industry-wide,
        aggregate data puts a typical reel between {INDUSTRY_LOW}% and{" "}
        {INDUSTRY_HIGH}%.
        {roster && (
          <>
            {" "}
            Across our roster the median is{" "}
            <b className="num">{Math.round(roster.roster_median)}%</b>, with the
            best reel at <span className="num">{Math.round(roster.best_skip_rate)}%</span> and
            the worst at <span className="num">{Math.round(roster.worst_skip_rate)}%</span>.
          </>
        )}
      </p>
      <p>
        Compare against the account&rsquo;s own median rather than a fixed
        target — audience and format shift it more than quality does.
      </p>
      <p style={{ marginBottom: 0 }}>
        Instagram reels only. No other platform reports it.
      </p>
    </div>
  );
}

/** Standalone link + panel, used where the explainer stands on its own. */
export default function SkipRateExplainer({
  roster,
}: {
  roster: SkipRoster | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button className="lnk" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        What is skip rate?
      </button>
      {open && (
        <>
          <hr className="r" />
          <SkipRatePanel roster={roster} />
        </>
      )}
    </div>
  );
}
