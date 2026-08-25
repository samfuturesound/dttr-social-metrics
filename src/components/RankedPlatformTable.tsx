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
    <span style={{ display: "block", marginTop: 3, fontSize: 11, lineHeight: 1.35 }}>
      {showAll && (
        <span
          style={{
            display: "block",
            color: props.rankAll === 1 ? "var(--ink)" : "var(--muted)",
            fontWeight: props.rankAll === 1 ? 700 : 400,
          }}
        >
          {ordinal(props.rankAll!)} of {props.totalAll} overall
        </span>
      )}
      {showType && (
        <span
          style={{
            display: "block",
            color: props.rankType === 1 ? "var(--ink)" : "var(--muted)",
            fontWeight: props.rankType === 1 ? 700 : 400,
          }}
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
      <div className="scroll">
        <table className="t">
          <thead>
            <tr>
              <th></th>
              <th>Posts</th>
              <th>Median views</th>
              <th>Median engagement</th>
              <th>Median completion</th>
              <th>Median skip</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.network}-${r.content_type}`} style={{ verticalAlign: "top" }}>
                <td>
                  {platformLabel(r.network, r.content_type)}
                </td>
                <td>{r.posts}</td>

                <td>
                  <span>
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

                <td>
                  <span>
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
                <td>
                  <span>
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
                <td>
                  {(() => {
                    const skip = skipByKey?.get(
                      `${r.brand_name}|${r.network}|${r.content_type}`,
                    );
                    if (skip == null) return null;
                    return (
                      <span style={{ whiteSpace: "nowrap" }}>
                        <span>{Math.round(skip)}%</span>
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
      <p className="note">
        Ranked against brands active on the same platform and format.
      </p>
    </>
  );
}
