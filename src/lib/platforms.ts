/**
 * The platform vocabulary, in one place.
 *
 * A "platform" here is network + content type together, never network alone:
 * Instagram posts and Instagram reels behave nothing like each other, and the
 * medians are not comparable across them. That is the same grain the database
 * keeps (`brand_platform_summary`, `monthly_trend`) and the same reason the
 * platform tables are split rather than pooled.
 *
 * Both the page-level filter and the trend chart's own control read this list,
 * so their keys cannot drift apart — the page filter sets the chart's platform
 * by key, which only works while both agree on the spelling.
 */
export const PLATFORMS = [
  { key: "tiktok|posts", label: "TikTok" },
  { key: "instagram|posts", label: "Instagram posts" },
  { key: "instagram|reels", label: "Instagram reels" },
] as const;

export type PlatformKey = (typeof PLATFORMS)[number]["key"];

/** The page-level filter adds "all", which is the default everywhere. */
export type PlatformFilterKey = "all" | PlatformKey;

export const PLATFORM_FILTER_OPTIONS = [
  { key: "all" as const, label: "All" },
  ...PLATFORMS,
] as const;

/** The human name for a selection. "All" has no platform name of its own. */
export function platformFilterLabel(key: PlatformFilterKey): string {
  return PLATFORM_FILTER_OPTIONS.find((o) => o.key === key)?.label ?? "All";
}

/**
 * The chart's platform, given a page selection: a key to lock it to, or null
 * to leave the chart its own control. "All" cannot lock it — the chart never
 * pools platforms, so under "All" it still has a platform of its own to pick.
 */
export function platformLock(key: PlatformFilterKey): PlatformKey | null {
  return key === "all" ? null : key;
}

/** Anything carrying the network + content_type pair, which every post-level
 *  and platform-level row in this app does. */
type HasPlatform = { network: string; content_type: string };

export function platformMatches(
  row: HasPlatform,
  key: PlatformFilterKey,
): boolean {
  return key === "all" || `${row.network}|${row.content_type}` === key;
}

/**
 * Narrow rows to the selected platform. Client-side on data already fetched —
 * every post-level and platform-level view carries both columns, so no filter
 * costs a round trip.
 */
export function onPlatform<T extends HasPlatform>(
  rows: T[],
  key: PlatformFilterKey,
): T[] {
  return key === "all" ? rows : rows.filter((r) => platformMatches(r, key));
}
