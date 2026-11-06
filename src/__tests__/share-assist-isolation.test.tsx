import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { BrandRow } from "../components/BrandRow";
import type { RowPost } from "../lib/types";

/**
 * The share routes must never render a paid-marking affordance.
 *
 * This is guarded in two independent ways, and this file asserts both, because
 * either alone can be defeated:
 *
 *  1. STRUCTURAL — SharePage and LabelSharePage must not import AssistMark and
 *     must not pass BrandRow's `assist` slot. BrandRow takes that slot as
 *     injected content precisely so a share page has to opt in explicitly;
 *     this test is what stops someone opting in by accident.
 *
 *  2. BEHAVIOURAL — BrandRow rendered without `assist` must produce no control
 *     in its markup, whatever the post's assist columns say. The share RPCs
 *     return no assist columns today, but that is a property of the SQL, not
 *     of this component, and SQL changes.
 *
 * Run with `bun test`.
 */

const src = (f: string) =>
  readFileSync(new URL(`../components/${f}`, import.meta.url), "utf8");

const SHARE_ROUTES = ["SharePage.tsx", "LabelSharePage.tsx"];

/** A post that IS assisted — the worst case for a leak. */
const assistedPost: RowPost = {
  external_id: "test-post-1",
  network: "tiktok",
  content_type: "posts",
  caption: "a post that has been marked as paid",
  permalink: "https://example.com/p/1",
  thumbnail_url: null,
  published_at: "2026-08-01",
  age_days: 30,
  views: 10000,
  median_views: 1000,
  views_multiple: 10,
  is_assisted: true,
  assisted_from: "2026-08-02",
};

describe("share routes carry no assist control", () => {
  for (const file of SHARE_ROUTES) {
    test(`${file} does not import AssistMark`, () => {
      const imports = /from\s+["'].*AssistMark["']/.test(src(file));
      expect(imports).toBe(false);
    });

    test(`${file} does not pass BrandRow's assist slot`, () => {
      // Catches `assist={...}` and `assist =` in any whitespace arrangement.
      // Asserted as a boolean so a failure reads as one line, not the file.
      const passesSlot = /\bassist\s*=/.test(src(file));
      expect(passesSlot).toBe(false);
    });

    test(`${file} never reaches the paid-marking RPC`, () => {
      // The grant is the real guard - anon holds no execute on mx_set_paid -
      // but a share page should not be calling it in the first place.
      const callsRpc = /\bsetPaid\b|mx_set_paid/.test(src(file));
      expect(callsRpc).toBe(false);
    });

    test(`${file} carries no toggle markers of its own`, () => {
      // Belt and braces for a control open-coded into the page rather than
      // imported: the pressed state and the hint copy are what AssistMark
      // renders, and neither belongs on an anon route.
      const s = src(file);
      expect(/aria-pressed/.test(s)).toBe(false);
      expect(/excluded from this account/i.test(s)).toBe(false);
      expect(/Mark paid/i.test(s)).toBe(false);
    });
  }

  test("only internal routes import AssistMark", () => {
    // LabelPage joined BrandPage and PostRow when marking reached label pages.
    // A share route appearing here is the leak this whole file exists to catch.
    const allowed = new Set(["PostRow.tsx", "BrandPage.tsx", "LabelPage.tsx"]);
    const importers = [
      "PostRow.tsx",
      "BrandPage.tsx",
      "LabelPage.tsx",
      ...SHARE_ROUTES,
    ].filter((f) => /from\s+["'].*AssistMark["']/.test(src(f)));
    for (const f of importers) expect(allowed.has(f)).toBe(true);
    // and the internal ones really do use it, so this test can't pass vacuously
    expect(importers.length).toBe(3);
  });
});

/**
 * The page-level platform filter is INTERNAL ONLY — the dashboard, brand pages
 * and label pages. That was a choice, not an oversight: a share link is a
 * fixed, dead-end view of one account's figures, read by someone who did not
 * build it, and a control that silently narrows the page to TikTok invites
 * exactly the misreading the share route is most exposed to. Internal readers
 * know what they filtered; an artist sent a link does not.
 *
 * Asserted structurally, the same way the paid-marking control is: the share
 * pages must not import the filter module at all. A behavioural test would
 * have to render each page with mocked RPCs, and the import is the thing that
 * would actually go wrong — someone copying a section across from BrandPage.
 *
 * The chart's own platform tabs are a separate control and stay on the share
 * routes, which is why those pages must also pass no platformKey: handing
 * TrendChart a lock hides its tabs, leaving a share reader with no way to see
 * another platform and no control that explains why.
 */
describe("share routes carry no page-level platform filter", () => {
  for (const file of SHARE_ROUTES) {
    test(`${file} does not import PlatformFilter`, () => {
      expect(/from\s+["'].*PlatformFilter["']/.test(src(file))).toBe(false);
    });

    test(`${file} does not render the filter or its marks`, () => {
      const s = src(file);
      expect(/<PlatformFilter\b/.test(s)).toBe(false);
      expect(/\bRollupStat\b|\bRollupNote\b/.test(s)).toBe(false);
      // The marker copy itself, in case a tile were open-coded rather than
      // imported — "all platforms" is a caveat about a filter that is not
      // there, so it has no business on a share page.
      expect(/all platforms/i.test(s)).toBe(false);
    });

    test(`${file} locks the chart to no platform`, () => {
      // No platformKey prop, and no import of the helper that produces one.
      expect(/\bplatformKey\s*=/.test(src(file))).toBe(false);
      expect(/\bplatformLock\b/.test(src(file))).toBe(false);
    });
  }

  test("only internal routes import PlatformFilter", () => {
    const allowed = new Set([
      "Dashboard.tsx",
      "BrandPage.tsx",
      "LabelPage.tsx",
    ]);
    const candidates = [...allowed, ...SHARE_ROUTES];
    const importers = candidates.filter((f) =>
      /from\s+["'].*PlatformFilter["']/.test(src(f)),
    );
    for (const f of importers) expect(allowed.has(f)).toBe(true);
    // and all three internal pages really do carry it, so this cannot pass
    // by the filter having been deleted everywhere.
    expect(importers.length).toBe(3);
  });

  test("every internal route that filters also locks the chart", () => {
    // Two controls for one choice is the bug this pairing prevents: a page
    // filtered to TikTok with the chart still offering its own tabs.
    for (const f of ["Dashboard.tsx", "BrandPage.tsx", "LabelPage.tsx"]) {
      const s = src(f);
      expect(/<TrendChart\b/.test(s)).toBe(true);
      expect(/platformKey=\{platformLock\(platform\)\}/.test(s)).toBe(true);
    }
  });
});

/**
 * The page-level LABEL selector is internal too, and for a further reason of
 * its own: the share RPCs return no label column at all, so a selector on a
 * share page would have nothing to filter on even if it belonged there.
 *
 * A label share link is already scoped to one label by its token. A control
 * offering to switch label on that page would either do nothing or imply the
 * reader can see labels the token does not cover.
 */
describe("share routes carry no label selector", () => {
  for (const file of SHARE_ROUTES) {
    test(`${file} does not import LabelFilter`, () => {
      expect(/from\s+["'].*LabelFilter["']/.test(src(file))).toBe(false);
    });

    test(`${file} renders no selector and no label caveat`, () => {
      const s = src(file);
      expect(/<LabelFilter\b/.test(s)).toBe(false);
      expect(/\bAllLabelsNote\b/.test(s)).toBe(false);
      expect(/all labels/i.test(s)).toBe(false);
      // No label scope reaches these pages at all.
      expect(/\bLabelScope\b|\bALL_LABELS\b|\bonLabel\b/.test(s)).toBe(false);
    });
  }

  test("only the board imports LabelFilter", () => {
    // The brand and label pages are single-scope by definition — one brand, or
    // one label — so a label selector has nothing to offer there either.
    const allowed = new Set(["Dashboard.tsx"]);
    const candidates = [
      "Dashboard.tsx",
      "BrandPage.tsx",
      "LabelPage.tsx",
      ...SHARE_ROUTES,
    ];
    const importers = candidates.filter((f) =>
      /from\s+["'].*LabelFilter["']/.test(src(f)),
    );
    for (const f of importers) expect(allowed.has(f)).toBe(true);
    expect(importers.length).toBe(1);
  });

  test("the share bar names no label", () => {
    // It used to print "Dance to the Radio" over every share page, including
    // an Eject Records artist's. The brand or label a link covers is named by
    // the page head, from the token.
    const s = src("Chrome.tsx");
    const bar = s.slice(s.indexOf("export function ShareBar"));
    const code = bar
      .split("\n")
      .filter((l) => !/^\s*(\*\/?|\/\/|\/\*)/.test(l))
      .join("\n");
    expect(code).not.toContain("Dance to the Radio");
    expect(code).toContain("Social Metrics");
  });
});

/**
 * The label pair specifically. LabelPage and LabelSharePage render the SAME
 * BrandRow component, so nothing about the row itself distinguishes internal
 * from public — the only thing that does is which caller passes the assist
 * slot. That makes this pair the sharpest version of the risk, and worth
 * asserting apart from the generic loop above.
 */
describe("the label pair diverges only at the call site", () => {
  test("the internal label page passes the slot", () => {
    const s = src("LabelPage.tsx");
    expect(/from\s+["'].*AssistMark["']/.test(s)).toBe(true);
    expect(/\bassist=\{/.test(s)).toBe(true);
  });

  test("the label share route passes nothing", () => {
    const s = src("LabelSharePage.tsx");
    expect(/from\s+["'].*AssistMark["']/.test(s)).toBe(false);
    expect(/\bassist\s*=/.test(s)).toBe(false);
  });

  test("a label share row renders no control, assisted or not", () => {
    // Rendered the way LabelSharePage renders Latest: brand-led meta, the
    // multiple on the right, no slot.
    const markup = renderToStaticMarkup(
      <BrandRow
        post={assistedPost}
        right="10×"
        meta="An Artist · 30 days old"
      />,
    );
    expect(markup).not.toMatch(/Mark paid/i);
    expect(markup).not.toMatch(/excluded from this account/i);
    expect(markup).not.toMatch(/aria-pressed/);
    expect(markup).not.toMatch(/<button/);
  });
});

describe("BrandRow without the assist slot", () => {
  const markup = renderToStaticMarkup(
    <BrandRow post={assistedPost} headline="10×" meta="30 days old" />,
  );

  test("renders no marking control even for an assisted post", () => {
    expect(markup).not.toMatch(/Mark paid/i);
    // The toggle's own markers: the hover hint and the pressed state.
    expect(markup).not.toMatch(/excluded from this account/i);
    expect(markup).not.toMatch(/aria-pressed/);
    expect(markup).not.toMatch(/<button/);
  });

  test("still renders the row itself", () => {
    expect(markup).toMatch(/a post that has been marked as paid/);
    expect(markup).toMatch(/10×/);
  });
});

describe("the guard is capable of failing", () => {
  // If BrandRow ever stops rendering the slot, the tests above would pass
  // while the real protection had quietly disappeared. This proves the slot
  // is live, so a leak really would be caught.
  const leaked = renderToStaticMarkup(
    <BrandRow
      post={assistedPost}
      headline="10×"
      meta="30 days old"
      assist={<button>Mark paid</button>}
    />,
  );

  test("an injected control does appear when the slot is used", () => {
    expect(leaked).toMatch(/Mark paid/);
  });
});
