import type {
  AccountScore,
  Brand,
  BrandType,
  FlaggedPost,
  Label,
  Period,
  TrendRow,
} from "./types";

// Fixtures shaped like real mx_flagged_interim rows (30-day window, 2026-08).
// Thumbnails: data-URI tiles stand in for Metricool S3 covers; one row has a
// deliberately broken URL to exercise the fallback; one has none.
const tile = (fill: string) =>
  `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96'%3E%3Crect width='96' height='96' fill='%23${fill}'/%3E%3C/svg%3E`;

/* ---------- Labels ----------------------------------------------------- */

/**
 * Label membership for the mock roster, in ONE place.
 *
 * Every fixture in this file used to carry `labels: ["Dance to the Radio"]`
 * written out on the row, which encoded the very assumption the app had to
 * stop making: that one label holds the whole roster. With the fixtures saying
 * so, mock mode could not show a label filter doing anything, and a test
 * written against them would pass whether or not the filter worked.
 *
 * So membership is declared once, here, and every fixture derives from it. The
 * shape mirrors production after the fix: most brands on Dance to the Radio,
 * two on Eject Records, and a third label with no brands at all.
 */
export const DTTR = "Dance to the Radio";
export const EJECT = "Eject Records";
export const SLAM_DUNK = "Slam Dunk Records";

/** Brands not listed here fall to Dance to the Radio, as in production. */
const LABELS_BY_BRAND: Record<string, string[]> = {
  "Reece Bibby": [EJECT],
  SOAP: [EJECT],
};

export function mockLabelsOf(brand: string): string[] {
  return LABELS_BY_BRAND[brand] ?? [DTTR];
}

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

/* ---------- Posts ------------------------------------------------------ */

const base = {
  owner: "Sam",
  engagement_pct: null as number | null,
  sample_size: 20,
  assisted_from: null as string | null,
  assist_kinds: null as string[] | null,
  is_assisted: false,
};

const FLAGGED: Omit<FlaggedPost, "labels">[] = [
  {
    ...base,
    external_id: "mock-lobjectif-65",
    brand_name: "L'objectif",
    brand_type: "artist",
    network: "tiktok",
    content_type: "posts",
    caption: "new single out friday. this one's different.",
    permalink: "https://www.tiktok.com/@example/video/1",
    thumbnail_url: tile("c9b8a4"),
    published_at: "2026-07-28",
    age_days: 14,
    views: 43999,
    median_views: 669,
    views_multiple: 65.7,
    skip_rate: null,
    avg_watch_seconds: null,
  },
  {
    ...base,
    external_id: "mock-tommy-reel-31",
    brand_name: "Tommy Ashby - The Birds",
    brand_type: "artist",
    network: "instagram",
    content_type: "reels",
    caption: "The Birds — out now. Full video on the channel.",
    permalink: "https://www.instagram.com/reel/example1/",
    thumbnail_url: "https://scontent-lhr6-2.cdninstagram.com/expired-token-404",
    published_at: "2026-07-26",
    age_days: 16,
    views: 9060,
    median_views: 2923,
    views_multiple: 3.1,
    skip_rate: 39.6,
    avg_watch_seconds: 8.9,
  },
  {
    ...base,
    external_id: "mock-tommy-tt-28",
    brand_name: "Tommy Ashby - The Birds",
    brand_type: "artist",
    network: "tiktok",
    content_type: "posts",
    caption: "acoustic version, one take",
    permalink: "https://www.tiktok.com/@example/video/2",
    thumbnail_url: tile("a8b0a4"),
    published_at: "2026-07-31",
    age_days: 11,
    views: 2626,
    median_views: 938,
    views_multiple: 2.8,
    skip_rate: null,
    avg_watch_seconds: null,
  },
  {
    ...base,
    external_id: "mock-twin-assisted",
    brand_name: "Twin Atlantic",
    brand_type: "artist",
    network: "instagram",
    content_type: "reels",
    caption: "Tour rehearsals, day one.",
    permalink: "https://www.instagram.com/reel/example2/",
    thumbnail_url: tile("b8a9a0"),
    published_at: "2026-07-18",
    age_days: 24,
    views: 33000,
    median_views: 12692,
    views_multiple: 2.6,
    skip_rate: 44.3,
    avg_watch_seconds: 9.2,
    assisted_from: "2026-07-25",
    assist_kinds: ["meta_ads"],
    is_assisted: true,
  },
  // Two Eject Records posts, so every board section differs between All and
  // Dance to the Radio in mock mode — the difference the whole change is about.
  {
    ...base,
    external_id: "mock-soap-tt-12",
    brand_name: "SOAP",
    brand_type: "artist",
    network: "tiktok",
    content_type: "posts",
    caption: "soundcheck, Manchester",
    permalink: "https://www.tiktok.com/@example/video/4",
    thumbnail_url: tile("9fa8b4"),
    published_at: "2026-08-04",
    age_days: 7,
    views: 187525,
    median_views: 31000,
    views_multiple: 6.1,
    skip_rate: null,
    avg_watch_seconds: null,
  },
  {
    ...base,
    external_id: "mock-reece-reel-08",
    brand_name: "Reece Bibby",
    brand_type: "artist",
    network: "instagram",
    content_type: "reels",
    caption: "writing session, take four",
    permalink: "https://www.instagram.com/reel/example3/",
    thumbnail_url: tile("b4a89f"),
    published_at: "2026-07-30",
    age_days: 12,
    views: 4100,
    median_views: 1950,
    views_multiple: 2.1,
    skip_rate: 41.2,
    avg_watch_seconds: 7.4,
  },
  {
    ...base,
    external_id: "mock-lofi-26",
    brand_name: "Lofi Bloom",
    brand_type: "theme",
    network: "tiktok",
    content_type: "posts",
    caption: "rainy window + that one synth line",
    permalink: "https://www.tiktok.com/@example/video/3",
    thumbnail_url: null,
    published_at: "2026-08-02",
    age_days: 9,
    views: 1960,
    median_views: 754,
    views_multiple: 2.6,
    skip_rate: null,
    avg_watch_seconds: null,
  },
];

export const MOCK_FLAGGED: FlaggedPost[] = FLAGGED.map((p) => ({
  ...p,
  labels: mockLabelsOf(p.brand_name),
}));

/* ---------- Brands ----------------------------------------------------- */

const BRANDS: {
  id: string;
  metricool_blog_id: number;
  name: string;
  brand_type: BrandType;
  active: boolean;
}[] = [
  { id: "b1", metricool_blog_id: 111, name: "Dance to the Radio", brand_type: "artist", active: true },
  { id: "b2", metricool_blog_id: 222, name: "L'objectif", brand_type: "artist", active: true },
  { id: "b3", metricool_blog_id: 333, name: "Twin Atlantic", brand_type: "artist", active: true },
  { id: "b4", metricool_blog_id: 444, name: "Lofi Bloom", brand_type: "theme", active: true },
  { id: "b5", metricool_blog_id: 555, name: "Night Drives", brand_type: "theme", active: false },
  { id: "b6", metricool_blog_id: 666, name: "SOAP", brand_type: "artist", active: true },
  { id: "b7", metricool_blog_id: 777, name: "Reece Bibby", brand_type: "artist", active: true },
];

export const MOCK_BRANDS: Brand[] = BRANDS.map((b) => ({
  ...b,
  owner: "Sam",
  labels: mockLabelsOf(b.name),
}));

/**
 * mx_labels, counted from the brands above rather than written out, so the
 * tiles on a label page and the counts in the selector cannot drift from the
 * roster they describe. Slam Dunk Records is here with no brands on purpose:
 * an empty label must still be selectable and must still render.
 */
export const MOCK_LABELS: Label[] = [DTTR, EJECT, SLAM_DUNK].map(
  (name, i) => {
    const mine = MOCK_BRANDS.filter((b) => b.labels.includes(name));
    return {
      label_id: i + 1,
      name,
      slug: slug(name),
      brands: mine.length,
      active_brands: mine.filter((b) => b.active).length,
      artist_brands: mine.filter((b) => b.brand_type === "artist").length,
      theme_brands: mine.filter((b) => b.brand_type === "theme").length,
    };
  },
);

export const MOCK_PERIOD: Period = {
  period_start: "2026-07-12",
  period_end: "2026-08-11",
  period_days: 30,
};

const SCORES: Omit<AccountScore, "labels">[] = [
  { brand_name: "SOAP", brand_type: "artist", owner: "Sam", posts: 31, total_score: 112.4, avg_multiple: 3.6, total_views: 402118, best_multiple: 6.1 },
  { brand_name: "L'objectif", brand_type: "artist", owner: "Sam", posts: 28, total_score: 93.9, avg_multiple: 3.4, total_views: 120453, best_multiple: 65.7 },
  { brand_name: "Tommy Ashby - The Birds", brand_type: "artist", owner: "Sam", posts: 36, total_score: 47.5, avg_multiple: 1.3, total_views: 28414, best_multiple: 3.1 },
  { brand_name: "Reece Bibby", brand_type: "artist", owner: "Sam", posts: 22, total_score: 34.1, avg_multiple: 1.6, total_views: 41980, best_multiple: 2.1 },
  { brand_name: "Lofi Bloom", brand_type: "theme", owner: "Sam", posts: 4, total_score: 6.1, avg_multiple: 1.5, total_views: 5120, best_multiple: 2.6 },
];

export const MOCK_ACCOUNT_SCORES: AccountScore[] = SCORES.map((s) => ({
  ...s,
  labels: mockLabelsOf(s.brand_name),
}));

/**
 * Trend fixtures for VITE_MOCK — shaped like mx_trend so the chart's multi
 * series path (selector, colour assignment, gaps, log spread) can be exercised
 * without a session. Deliberately includes missing months and a 400x spread
 * between the biggest and smallest account.
 *
 * The last month is provisional, so mock mode exercises the dashed treatment
 * and the settling line without waiting for a real calendar.
 */
const TREND_MONTHS = [
  "2026-02-01",
  "2026-03-01",
  "2026-04-01",
  "2026-05-01",
  "2026-06-01",
  "2026-07-01",
];

const TREND_SHAPE: [string, string, (number | null)[]][] = [
  ["SOAP", "tiktok", [4200, 9800, 31000, 88000, 187525, 120400]],
  ["Nature", "tiktok", [474, 610, null, 890, 1240, 1580]],
  ["Lofi Bloom", "tiktok", [1800, 2400, 3100, null, 5200, 6100]],
  ["L'objectif", "tiktok", [12000, 9400, 15600, 22000, null, 18400]],
  ["Far Caspian", "tiktok", [900, 1150, 1020, 1380, 1610, 1490]],
  ["Twin Atlantic", "tiktok", [null, null, 1080, 1240, 1010, 1310]],
  ["Gravy", "tiktok", [640, null, 780, 820, 960, null]],
  ["Tommy Ashby", "tiktok", [2100, 2600, null, 3400, 4100, 3900]],
  ["Reece Bibby", "tiktok", [null, 520, 680, 740, null, 910]],
  ["Big Warm Bed", "tiktok", [1500, 1720, 1900, null, 2400, 2650]],
  ["SOAP", "instagram", [8800, 14200, 26000, 41000, 62000, 55000]],
  ["Far Caspian", "instagram", [21000, 19400, 26300, null, 31200, 28900]],
  ["Twin Atlantic", "instagram", [9200, 9949, null, 11400, 10800, 12100]],
  // Two single-month series, on the platform with few enough accounts that
  // both fall inside the default five — this is the case that used to render
  // as a bare dot and read as a rendering failure. One of them is the
  // provisional month, so a lone point and the dashed treatment coincide.
  ["Pale Blue Eyes", "instagram", [null, null, null, null, null, 19000]],
  ["Cable Street", "instagram", [null, null, 8200, null, null, null]],
];

/** The last fixture month stands in for the month that has ended but not
 *  settled. Real rows get this from the view's own calendar. */
const PROVISIONAL_MONTH = TREND_MONTHS[TREND_MONTHS.length - 1];

export const MOCK_TREND: TrendRow[] = TREND_SHAPE.flatMap(
  ([brand, network, values]) =>
    values.flatMap((v, i) =>
      v === null
        ? []
        : [
            {
              brand_name: brand,
              labels: mockLabelsOf(brand),
              network,
              content_type: network === "instagram" ? "reels" : "posts",
              month: TREND_MONTHS[i],
              posts: 3 + ((i * 7 + brand.length) % 9),
              median_views: v,
              median_engagement_rate:
                Math.round((2 + ((i * 13 + brand.length) % 90) / 10) * 10) / 10,
              growth_multiple:
                i === 0 || values[i - 1] == null
                  ? null
                  : Math.round((v / (values[i - 1] as number)) * 100) / 100,
              // Mostly zero, so the tooltip's non-zero branch is exercised in
              // mock mode without appearing on every point.
              paid_excluded: (i * 5 + brand.length) % 7 === 0 ? 1 + (i % 2) : 0,
              is_provisional: TREND_MONTHS[i] === PROVISIONAL_MONTH,
            },
          ],
    ),
);
