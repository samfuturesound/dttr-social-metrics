import { compact, ordinal } from "../lib/format";
import type { BrandPlatformRanks, BrandType } from "../lib/types";
import { platformLabel } from "./BrandRow";
import { SkipMarker } from "./SkipRateExplainer";

/**
 * Platform medians with roster position — INTERNAL BRAND PAGE ONLY.
 *
 * Deliberately a separate component from the share page's PlatformTable
 * rather than one component behind a flag: an artist viewing a /share/ link
 * must never see where they sit against the rest of the roster, and a flag
 * is one wrong prop away from leaking that. The share route also has no way
 * to obtain this data — mx_share_summary returns no rank columns.
 *
 * Ranks are cohort-specific in two ways the UI must not blur:
 *  - scoped to the same network AND content type (a TikTok median is ranked
 *    only against other brands' TikTok medians, never against Instagram);
 *  - the denominator counts only brands with data in that cohort, so
 *    "4th of 7" means seven brands post to TikTok at all.
 */

function cohortNoun(brandType: BrandType): string {
  return brandType === "theme" ? "theme accounts" : "artists";
}

/** Two rank lines under a median. Suppressed entirely when the cohort is
 *  empty — the view reports "1 of 0" where a metric doesn't apply (e.g.
 *  completion on TikTok), which must never render. */
function RankLines(props: {
  rankAll: number | null;
  totalAll: number;
  rankType: number | null;
  totalType: number;
  brandType: BrandType;
}) {
  const showAll = props.rankAll !== null && props.totalAll > 0;
  const showType = props.rankType !== null && props.totalType > 0;
  if (!showAll && !showType) return null;
  return (
    <span className="mt-1 block text-[11px] leading-snug">
      {showAll && (
        <span
          className={`block ${props.rankAll === 1 ? "text-ink" : "text-dim"}`}
        >
          {ordinal(props.rankAll!)} of {props.totalAll} overall
        </span>
      )}
      {showType && (
        <span
          className={`block ${props.rankType === 1 ? "text-ink" : "text-dim"}`}
        >
          {ordinal(props.rankType!)} of {props.totalType}{" "}
          {cohortNoun(props.brandType)}
        </span>
      )}
    </span>
  );
}

export default function RankedPlatformTable({
  rows,
  skipByKey,
}: {
  rows: BrandPlatformRanks[];
  /** brand|network|content_type -> median skip rate. Reels only; the
   *  ranks view carries no skip figures of its own. */
  skipByKey?: Map<string, number | null>;
}) {
  if (rows.length === 0) return null;
  return (
    <>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full max-w-3xl text-left text-sm">
          <thead>
            <tr className="border-b border-line text-[11px] font-medium uppercase tracking-[0.15em] text-dim">
              <th className="py-2 pr-4 font-medium"></th>
              <th className="py-2 pr-4 font-medium">Posts</th>
              <th className="py-2 pr-4 font-medium">Median views</th>
              <th className="py-2 pr-4 font-medium">Median engagement</th>
              <th className="py-2 pr-4 font-medium">Median completion</th>
              <th className="py-2 font-medium">Median skip</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={`${r.network}-${r.content_type}`} className="align-top">
                <td className="py-3 pr-4">
                  {platformLabel(r.network, r.content_type)}
                </td>
                <td className="py-3 pr-4 font-serif">{r.posts}</td>

                <td className="py-3 pr-4">
                  <span className="font-serif">
                    {r.median_views !== null ? compact(r.median_views) : ""}
                  </span>
                  {r.median_views !== null && (
                    <RankLines
                      rankAll={r.rank_views_all}
                      totalAll={r.total_views_all}
                      rankType={r.rank_views_type}
                      totalType={r.total_views_type}
                      brandType={r.brand_type}
                    />
                  )}
                </td>

                <td className="py-3 pr-4">
                  <span className="font-serif">
                    {r.median_engagement_rate !== null
                      ? r.median_engagement_rate.toFixed(1)
                      : ""}
                  </span>
                  {r.median_engagement_rate !== null && (
                    <RankLines
                      rankAll={r.rank_eng_all}
                      totalAll={r.total_eng_all}
                      rankType={r.rank_eng_type}
                      totalType={r.total_eng_type}
                      brandType={r.brand_type}
                    />
                  )}
                </td>

                {/* Completion exists on Instagram reels only — blank elsewhere,
                    including its ranks. */}
                <td className="py-3 pr-4">
                  <span className="font-serif">
                    {r.median_completion_pct !== null
                      ? `${Math.round(r.median_completion_pct)}%`
                      : ""}
                  </span>
                  {r.median_completion_pct !== null && (
                    <RankLines
                      rankAll={r.rank_completion_all}
                      totalAll={r.total_completion_all}
                      rankType={r.rank_completion_type}
                      totalType={r.total_completion_type}
                      brandType={r.brand_type}
                    />
                  )}
                </td>

                {/* Skip rate is Instagram reels only, and has no ranks. */}
                <td className="py-3">
                  {(() => {
                    const skip = skipByKey?.get(
                      `${r.brand_name}|${r.network}|${r.content_type}`,
                    );
                    if (skip == null) return null;
                    return (
                      <span className="whitespace-nowrap">
                        <span className="font-serif">{Math.round(skip)}%</span>
                        <SkipMarker skipRate={skip} />
                      </span>
                    );
                  })()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 max-w-prose text-[13px] leading-relaxed text-dim">
        Ranked against brands active on the same platform and format.
      </p>
    </>
  );
}
