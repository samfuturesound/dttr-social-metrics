import { useState } from "react";
import { refreshDerived, setPaid } from "../lib/data";

/**
 * Paid marking for one post row. A single toggle, nothing more.
 *
 * INTERNAL ONLY. Imported by PostRow and BrandPage; the share routes must never
 * render it. That is asserted in src/__tests__/share-assist-isolation.test.tsx,
 * and enforced at the database by mx_set_paid being executable by
 * `authenticated` only — anon holds no grant on it.
 *
 * This replaces the earlier popover (kind, dates, spend, notes, a list of
 * interventions with per-row removal). All of it is gone deliberately: it read
 * as a media-buying record rather than the one flag the median actually cares
 * about. The whole feature is the sentence in HINT.
 */

/** The entire explanation of what marking does. Shown on hover of the control. */
const HINT = "Paid posts are excluded from this account's median.";

export default function AssistMark({
  externalId,
  isPaid,
  reload,
  showControl,
}: {
  externalId: string;
  /** is_assisted from the post view. */
  isPaid: boolean;
  reload: () => Promise<void>;
  /** False on sections that show paid state but don't offer marking
   *  (Best performing, Most viewed). The "Paid" marker still renders. */
  showControl?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  /** What mx_set_paid last returned, held only until the refetch lands. */
  const [result, setResult] = useState<boolean | null>(null);
  const [toggled, setToggled] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshed, setRefreshed] = useState(false);

  const control = showControl !== false;
  const marked = result ?? isPaid;

  async function toggle() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      // The function returns the resulting state; trust that rather than
      // assuming the click did what we asked. It is idempotent, so a double
      // click is harmless.
      setResult(await setPaid(externalId, !marked));
      setRefreshed(false);
      setToggled(true);
      // No optimistic score update: the account median genuinely moves, and the
      // real number should be what lands on screen.
      await reload();
      setResult(null); // the refetched row is authoritative again
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    setRefreshing(true);
    try {
      await refreshDerived();
      setRefreshed(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshing(false);
    }
  }

  if (!marked && !control) return null;

  // Not offered a control: the marker is a plain label, not a button.
  if (!control) {
    return <span className="tag">Paid</span>;
  }

  return (
    <span style={{ whiteSpace: "nowrap" }}>
      <button
        className={marked ? "tag" : "lnk"}
        onClick={toggle}
        disabled={busy}
        aria-pressed={marked}
        title={HINT}
      >
        {marked ? "Paid" : "Mark paid"}
      </button>

      {/* Leading and Latest read scored_posts live, so the row above has already
          caught up. Share pages read post_detail_mv and will not until 03:30. */}
      {toggled && !err && (
        <>
          {" "}
          {refreshed ? (
            <span style={{ color: "var(--muted)" }}>Share pages refreshed.</span>
          ) : (
            <button className="lnk" disabled={refreshing} onClick={refresh}>
              {refreshing ? "Refreshing…" : "Refresh share pages now"}
            </button>
          )}
        </>
      )}

      {err && <span className="err-line"> {err}</span>}
    </span>
  );
}
