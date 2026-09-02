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
  }

  test("only internal routes import AssistMark", () => {
    const allowed = new Set(["PostRow.tsx", "BrandPage.tsx"]);
    const importers = ["PostRow.tsx", "BrandPage.tsx", ...SHARE_ROUTES].filter(
      (f) => /from\s+["'].*AssistMark["']/.test(src(f)),
    );
    for (const f of importers) expect(allowed.has(f)).toBe(true);
    // and the internal ones really do use it, so this test can't pass vacuously
    expect(importers.length).toBe(2);
  });
});

describe("BrandRow without the assist slot", () => {
  const markup = renderToStaticMarkup(
    <BrandRow post={assistedPost} headline="10×" meta="30 days old" />,
  );

  test("renders no marking control even for an assisted post", () => {
    expect(markup).not.toMatch(/Mark paid/i);
    expect(markup).not.toMatch(/Paid support/i);
    expect(markup).not.toMatch(/role="dialog"/);
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
