import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  ALL_LABELS,
  brandsInScope,
  isAllLabels,
  labelScope,
  onLabel,
  reselectScope,
  scopeKey,
  scopeLabel,
  scopeLabelName,
} from "../lib/labels";
import {
  DTTR,
  EJECT,
  MOCK_ACCOUNT_SCORES,
  MOCK_BRANDS,
  MOCK_FLAGGED,
  MOCK_LABELS,
  MOCK_TREND,
  SLAM_DUNK,
} from "../lib/mock";
import type { Label } from "../lib/types";

/**
 * ALL is not a label.
 *
 * It used to be, in effect: "Dance to the Radio" carried every brand on the
 * roster, so filtering to that label and showing everything produced the same
 * page. Code could conflate the two and nothing would look wrong. The label
 * data has since been fixed — Dance to the Radio carries its own nine active
 * artists, Eject Records two, Slam Dunk Records none — and the conflation is
 * now a bug that shows a label's page as if it were the whole roster.
 *
 * The first test here is the one that matters: under the old data it could not
 * fail, because the two sets were identical. It only means something because
 * the fixtures now carry more than one label, which is why lib/mock.ts
 * declares membership once and derives every row from it.
 *
 * Run with `bun test`.
 */

const labelByName = (name: string): Label => {
  const l = MOCK_LABELS.find((x) => x.name === name);
  if (!l) throw new Error(`fixture has no label ${name}`);
  return l;
};

const dttr = labelScope(labelByName(DTTR));
const eject = labelScope(labelByName(EJECT));
const slamDunk = labelScope(labelByName(SLAM_DUNK));

describe("ALL and a label are different scopes", () => {
  test("ALL and Dance to the Radio return different brand sets", () => {
    const all = brandsInScope(MOCK_FLAGGED, ALL_LABELS);
    const one = brandsInScope(MOCK_FLAGGED, dttr);

    // The assertion the old data could not make: these two must not agree.
    expect([...one].sort()).not.toEqual([...all].sort());
    expect(one.size).toBeLessThan(all.size);

    // And concretely: the brands ALL has that the label does not are exactly
    // the ones on another label.
    const onlyInAll = [...all].filter((b) => !one.has(b)).sort();
    expect(onlyInAll.length).toBeGreaterThan(0);
    for (const brand of onlyInAll) {
      const row = MOCK_FLAGGED.find((p) => p.brand_name === brand);
      expect(row?.labels).not.toContain(DTTR);
    }
  });

  test("the same holds for the leaderboard and the trend", () => {
    for (const rows of [MOCK_ACCOUNT_SCORES, MOCK_TREND, MOCK_BRANDS]) {
      const all = brandsInScope(
        rows.map((r) => ({
          ...r,
          brand_name: "brand_name" in r ? r.brand_name : r.name,
        })),
        ALL_LABELS,
      );
      const one = brandsInScope(
        rows.map((r) => ({
          ...r,
          brand_name: "brand_name" in r ? r.brand_name : r.name,
        })),
        dttr,
      );
      expect(one.size).toBeLessThan(all.size);
    }
  });

  test("the labels partition the roster — no label holds all of it", () => {
    const all = brandsInScope(MOCK_FLAGGED, ALL_LABELS);
    for (const label of MOCK_LABELS) {
      const held = brandsInScope(MOCK_FLAGGED, labelScope(label));
      expect(held.size).toBeLessThan(all.size);
    }
  });

  test("ALL narrows nothing at all", () => {
    // Not "every row matches some label" — the rows come back untouched, so a
    // brand carrying no label yet is still on the board under ALL.
    expect(onLabel(MOCK_FLAGGED, ALL_LABELS)).toBe(MOCK_FLAGGED);
    const untagged = [{ brand_name: "Unassigned", labels: [] }];
    expect(onLabel(untagged, ALL_LABELS)).toHaveLength(1);
    expect(onLabel(untagged, dttr)).toHaveLength(0);
  });

  test("Eject Records is its own set, not a slice of Dance to the Radio", () => {
    const a = brandsInScope(MOCK_FLAGGED, dttr);
    const b = brandsInScope(MOCK_FLAGGED, eject);
    expect(b.size).toBeGreaterThan(0);
    for (const brand of b) expect(a.has(brand)).toBe(false);
  });
});

describe("ALL carries no label, so it can reach no label's token", () => {
  test("ALL resolves to no label, name or slug", () => {
    expect(isAllLabels(ALL_LABELS)).toBe(true);
    expect(scopeLabel(ALL_LABELS)).toBeNull();
    expect(scopeLabelName(ALL_LABELS)).toBeNull();
  });

  test("a label scope does resolve, so the pair above is not vacuous", () => {
    expect(isAllLabels(dttr)).toBe(false);
    expect(scopeLabelName(dttr)).toBe(DTTR);
    expect(scopeLabel(dttr)?.slug).toBe("dance-to-the-radio");
  });

  test("no label's key can collide with ALL — even a label called All", () => {
    expect(scopeKey(ALL_LABELS)).toBe("all");
    const awkward: Label = {
      label_id: 99,
      name: "All",
      slug: "all",
      brands: 3,
      active_brands: 3,
      artist_brands: 3,
      theme_brands: 0,
    };
    expect(scopeKey(labelScope(awkward))).not.toBe(scopeKey(ALL_LABELS));
    for (const l of MOCK_LABELS)
      expect(scopeKey(labelScope(l))).not.toBe("all");
  });

  test("a label that disappears falls back to ALL, never to another label", () => {
    const gone = reselectScope(dttr, [labelByName(EJECT)]);
    expect(isAllLabels(gone)).toBe(true);

    // and a label still present is re-resolved to the fresh row, not kept
    const restated: Label = { ...labelByName(DTTR), active_brands: 99 };
    expect(scopeLabel(reselectScope(dttr, [restated]))?.active_brands).toBe(99);
  });
});

describe("a label with no brands", () => {
  test("is a real option, not an absent one", () => {
    expect(MOCK_LABELS.map((l) => l.name)).toContain(SLAM_DUNK);
    expect(labelByName(SLAM_DUNK).brands).toBe(0);
  });

  test("selects cleanly and returns nothing, rather than throwing", () => {
    expect(() => onLabel(MOCK_FLAGGED, slamDunk)).not.toThrow();
    expect(onLabel(MOCK_FLAGGED, slamDunk)).toHaveLength(0);
    expect(onLabel(MOCK_TREND, slamDunk)).toHaveLength(0);
    expect(brandsInScope(MOCK_FLAGGED, slamDunk).size).toBe(0);
  });
});

describe("the options come from the data, not from a list in the code", () => {
  const src = (f: string) =>
    readFileSync(new URL(`../${f}`, import.meta.url), "utf8");

  // A new label must appear in the selector with no code change, so neither
  // the scope module nor the control may name one. mock.ts is excluded on
  // purpose — fixtures have to name something.
  // Both files discuss the labels by name in prose — that history is the
  // reason they are shaped as they are — so comment lines are stripped and
  // only the code is checked.
  const codeOf = (file: string) =>
    src(file)
      .split("\n")
      .filter((l) => !/^\s*(\*\/?|\/\/|\/\*)/.test(l))
      .join("\n");

  for (const file of ["lib/labels.ts", "components/LabelFilter.tsx"]) {
    test(`${file} hardcodes no label name`, () => {
      const code = codeOf(file);
      for (const name of [DTTR, EJECT, SLAM_DUNK]) {
        expect(code).not.toContain(name);
      }
      // and the stripping did not simply remove everything
      expect(code).toContain("export");
    });
  }

  test("the selector's options are whatever mx_labels returned", () => {
    const s = src("components/LabelFilter.tsx");
    // Built from the prop, with ALL in front — not from a constant.
    expect(s).toMatch(/\[ALL_LABELS,\s*\.\.\.labels\.map\(labelScope\)\]/);
    expect(s).toMatch(/labels:\s*Label\[\]/);
  });
});

describe("every fixture row can be filtered", () => {
  // A row with no labels silently vanishes under every label selection. In
  // production the column is never null for a brand that exists, so a fixture
  // missing it would make the mock board behave unlike the real one.
  test("MOCK_FLAGGED, MOCK_ACCOUNT_SCORES and MOCK_TREND all carry labels", () => {
    for (const p of MOCK_FLAGGED) expect(p.labels.length).toBeGreaterThan(0);
    for (const a of MOCK_ACCOUNT_SCORES)
      expect(a.labels.length).toBeGreaterThan(0);
    for (const t of MOCK_TREND)
      expect((t.labels ?? []).length).toBeGreaterThan(0);
    for (const b of MOCK_BRANDS) expect(b.labels.length).toBeGreaterThan(0);
  });

  test("mx_labels counts agree with the brands they describe", () => {
    for (const l of MOCK_LABELS) {
      const mine = MOCK_BRANDS.filter((b) => b.labels.includes(l.name));
      expect(l.brands).toBe(mine.length);
      expect(l.active_brands).toBe(mine.filter((b) => b.active).length);
      expect(l.artist_brands + l.theme_brands).toBe(l.brands);
    }
  });
});
