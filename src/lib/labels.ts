import type { Label } from "./types";

/**
 * The page's label scope: either ALL, or exactly one label.
 *
 * ALL IS NOT A LABEL. It used to be, in effect — "Dance to the Radio" carried
 * every brand on the roster, so showing that label and showing everything were
 * the same page, and nothing in the code had to tell them apart. That is no
 * longer true: Dance to the Radio carries its own nine active artists, Eject
 * Records carries two, and Slam Dunk Records carries none.
 *
 * So the two are modelled as different shapes rather than as two values of one
 * string. A `{ kind: "all" }` scope holds no label, which means no code path
 * can reach a label's name, slug or share token from it — not by a default, not
 * by a fallback, not by a `?? labels[0]`. `scopeLabel` returns null for ALL and
 * every caller has to handle that, which is the point: the compiler asks the
 * question the old data let everyone skip.
 *
 * The labels themselves always come from mx_labels, never from a list in here.
 * A new label appears in the selector as soon as it exists in the database,
 * including one with no brands yet.
 */
export type LabelScope =
  | { readonly kind: "all" }
  | { readonly kind: "label"; readonly label: Label };

/** The default on every page that carries the selector. */
export const ALL_LABELS: LabelScope = { kind: "all" };

export function labelScope(label: Label): LabelScope {
  return { kind: "label", label };
}

export function isAllLabels(scope: LabelScope): boolean {
  return scope.kind === "all";
}

/**
 * The selected label, or null under ALL — the only way to reach a slug, and so
 * the only way to reach the label page or a label share token.
 */
export function scopeLabel(scope: LabelScope): Label | null {
  return scope.kind === "label" ? scope.label : null;
}

/** The selected label's name, or null under ALL. */
export function scopeLabelName(scope: LabelScope): string | null {
  return scope.kind === "label" ? scope.label.name : null;
}

/**
 * A stable identity for the selection, for comparing the pressed tab.
 *
 * The "label:" prefix is load-bearing: ALL is `"all"` and a label is
 * `"label:<slug>"`, so a label named "All" — slug `all` — still cannot collide
 * with the ALL option. Two different things never share a key.
 */
export function scopeKey(scope: LabelScope): string {
  return scope.kind === "all" ? "all" : `label:${scope.label.slug}`;
}

/** Display only. Never pass this anywhere that expects a label name. */
export function scopeTitle(scope: LabelScope): string {
  return scope.kind === "all" ? "All accounts" : scope.label.name;
}

/**
 * Re-resolve a held scope against a freshly fetched mx_labels, by slug.
 *
 * A scope carries the Label row it was chosen from, so after a reload it would
 * otherwise hold counts from the previous fetch. A label that has gone falls
 * back to ALL and never to another label — a silent swap to a neighbouring
 * label is the failure mode this whole change exists to remove.
 */
export function reselectScope(scope: LabelScope, labels: Label[]): LabelScope {
  if (scope.kind === "all") return ALL_LABELS;
  const again = labels.find((l) => l.slug === scope.label.slug);
  return again ? labelScope(again) : ALL_LABELS;
}

/**
 * Anything carrying the brand's label array. Every post-level and brand-level
 * mx_* view returns `labels` except the rollups noted in LabelFilter, and the
 * share RPCs, which return none — which is why the selector is internal-only.
 */
type HasLabels = { labels?: string[] | null };

export function labelMatches(row: HasLabels, scope: LabelScope): boolean {
  if (scope.kind === "all") return true;
  return (row.labels ?? []).includes(scope.label.name);
}

/**
 * Narrow rows to the selected label. Client-side on data already fetched, the
 * same way the platform filter works — the label array is on the row, so a
 * selection costs no round trip and no loading state.
 *
 * Under ALL the rows are returned untouched: ALL means "don't narrow by label",
 * not "narrow by some label that happens to hold everything".
 */
export function onLabel<T extends HasLabels>(
  rows: T[],
  scope: LabelScope,
): T[] {
  if (scope.kind === "all") return rows;
  return rows.filter((r) => labelMatches(r, scope));
}

/**
 * The brand names a scope covers, drawn from rows that carry labels. Used to
 * narrow the few sources that are keyed by brand_name but carry no label
 * column of their own — mx_brand_skip_rates is the one on the board.
 */
export function brandsInScope(
  rows: (HasLabels & { brand_name: string })[],
  scope: LabelScope,
): Set<string> {
  return new Set(onLabel(rows, scope).map((r) => r.brand_name));
}
