import type { AccountScore, Brand, FlaggedPost, Period } from "./types";

// Fixtures shaped like real mx_flagged_interim rows (30-day window, 2026-08).
// Thumbnails: data-URI tiles stand in for Metricool S3 covers; one row has a
// deliberately broken URL to exercise the fallback; one has none.
const tile = (fill: string) =>
  `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96'%3E%3Crect width='96' height='96' fill='%23${fill}'/%3E%3C/svg%3E`;

const base = {
  owner: "Sam",
  engagement_pct: null as number | null,
  sample_size: 20,
  assisted_from: null as string | null,
  assist_kinds: null as string[] | null,
  is_assisted: false,
};

export const MOCK_FLAGGED: FlaggedPost[] = [
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

export const MOCK_BRANDS: Brand[] = [
  { id: "b1", metricool_blog_id: 111, name: "Dance to the Radio", brand_type: "artist", owner: "Sam", active: true },
  { id: "b2", metricool_blog_id: 222, name: "L'objectif", brand_type: "artist", owner: "Sam", active: true },
  { id: "b3", metricool_blog_id: 333, name: "Twin Atlantic", brand_type: "artist", owner: "Sam", active: true },
  { id: "b4", metricool_blog_id: 444, name: "Lofi Bloom", brand_type: "theme", owner: "Sam", active: true },
  { id: "b5", metricool_blog_id: 555, name: "Night Drives", brand_type: "theme", owner: "Sam", active: false },
];

export const MOCK_PERIOD: Period = {
  period_start: "2026-07-12",
  period_end: "2026-08-11",
  period_days: 30,
};

export const MOCK_ACCOUNT_SCORES: AccountScore[] = [
  { brand_name: "L'objectif", brand_type: "artist", owner: "Sam", posts: 28, total_score: 93.9, avg_multiple: 3.4, total_views: 120453, best_multiple: 65.7 },
  { brand_name: "Tommy Ashby - The Birds", brand_type: "artist", owner: "Sam", posts: 36, total_score: 47.5, avg_multiple: 1.3, total_views: 28414, best_multiple: 3.1 },
  { brand_name: "Lofi Bloom", brand_type: "theme", owner: "Sam", posts: 4, total_score: 6.1, avg_multiple: 1.5, total_views: 5120, best_multiple: 2.6 },
];
