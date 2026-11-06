import type { Label } from "../lib/types";
import { labelPath, navigate } from "../lib/router";
import {
  ALL_LABELS,
  isAllLabels,
  labelScope,
  scopeKey,
  scopeLabel,
  type LabelScope,
} from "../lib/labels";

/**
 * Page-level label selector — All, then one option per label in mx_labels.
 *
 * INTERNAL PAGES ONLY, for the same reason the platform filter is: a share
 * link is a fixed view of one account's or one label's figures, sent to someone
 * who did not build it, and a control that silently narrows it invites the
 * misreading those pages are most exposed to. The share routes also could not
 * honour it — their RPCs return no label column at all.
 *
 * ---------------------------------------------------------------------------
 * WHY "ALL" IS AN OPTION AND NOT A LABEL
 *
 * Until the label data was fixed, "Dance to the Radio" carried every brand on
 * the roster, so the label and the whole roster were the same set and nothing
 * had to distinguish them. They are now different: Dance to the Radio carries
 * its own nine active artists. All is therefore a scope of its own — see
 * LabelScope in lib/labels.ts, where it is a shape that holds no label, so it
 * cannot resolve to a label's name, slug or share token by any path.
 *
 * ---------------------------------------------------------------------------
 * THE OPTIONS ARE DATA, NOT A LIST IN HERE
 *
 * Every option after All comes from mx_labels, in the order the view returns
 * (by name). A label with no brands yet — Slam Dunk Records, today — is still
 * an option, and selecting it shows an empty page rather than an error: a label
 * that exists and is empty is an ordinary state, and hiding it would make a new
 * label look broken until someone tagged a brand. A label added in the Brands
 * panel appears here on the next load with no code change.
 */
export default function LabelFilter({
  labels,
  value,
  onChange,
}: {
  labels: Label[];
  value: LabelScope;
  onChange: (scope: LabelScope) => void;
}) {
  const options: LabelScope[] = [ALL_LABELS, ...labels.map(labelScope)];
  const active = scopeKey(value);
  const label = scopeLabel(value);

  return (
    <div className="card">
      <div className="eyebrow">
        <span>Label</span>
      </div>
      <div
        role="group"
        aria-label="Filter this page by label"
        style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
      >
        {options.map((o) => {
          const key = scopeKey(o);
          const on = key === active;
          return (
            <button
              key={key}
              className={`tab${on ? " on" : ""}`}
              aria-pressed={on}
              onClick={() => onChange(o)}
            >
              {isAllLabels(o) ? "All" : scopeLabel(o)?.name}
            </button>
          );
        })}
      </div>

      {/* An empty label gets no note here: the page itself says so, in one
          place, where the reader is looking for the missing content. Saying it
          twice on one screen reads as two different problems. */}
      {label && label.brands > 0 && (
        <p className="note">
          Every section on this page covers <b>{label.name}</b> only —{" "}
          {label.active_brands} active account
          {label.active_brands === 1 ? "" : "s"} of {label.brands} tagged.{" "}
          <a
            href={labelPath(label.slug)}
            onClick={(e) => {
              e.preventDefault();
              navigate(labelPath(label.slug));
            }}
          >
            Open the {label.name} page
          </a>{" "}
          for its per-brand tables and share links.
        </p>
      )}
    </div>
  );
}

/**
 * The caveat for a figure that has no label grain at all.
 *
 * Only one source on the board is in this position: mx_skip_roster, which is a
 * single whole-roster median with no brand or label columns to slice. It is
 * marked rather than hidden, for the reason set out in PlatformFilter — a
 * number that disappears teaches nothing about why, and a number carrying its
 * own caveat cannot be mistaken for a filtered one.
 */
export function AllLabelsNote({
  scope,
  children,
}: {
  scope: LabelScope;
  children: React.ReactNode;
}) {
  if (isAllLabels(scope)) return null;
  return (
    <p className="note" style={{ color: "var(--ink)" }}>
      <b>All labels.</b> {children}
    </p>
  );
}
