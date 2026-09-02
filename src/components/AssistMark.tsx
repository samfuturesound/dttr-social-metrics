import { useEffect, useRef, useState, type FormEvent } from "react";
import { addIntervention, refreshDerived, removeIntervention } from "../lib/data";
import { shortDate } from "../lib/format";
import {
  INTERVENTION_KINDS,
  INTERVENTION_LABELS,
  type Intervention,
} from "../lib/types";

/**
 * Paid/assisted marking for one post row.
 *
 * INTERNAL ONLY. This is imported by Dashboard and BrandPage; the share routes
 * must never render it, and the share RPCs return no assist columns anyway.
 *
 * Two parts, both on the row:
 *  - the marker, when the post is already assisted — "assisted from <date>"
 *    plus the kind. The de-emphasis of the multiple is the theme's
 *    `.post.assisted` rule, applied by the row itself.
 *  - a quiet trigger that opens a compact popover. Deliberately a text link
 *    rather than a button: it must not compete with the post.
 */
export default function AssistMark({
  externalId,
  publishedAt,
  interventions,
  assistedFrom,
  assistKinds,
  reload,
  showControl,
}: {
  externalId: string;
  /** Default for the Started field — the post's own publish date. */
  publishedAt: string;
  /** Rows from mx_interventions already filtered to this post. */
  interventions: Intervention[];
  assistedFrom?: string | null;
  /** assist_kinds from the post view — a comma-joined list on the row. */
  assistKinds?: string[] | string | null;
  reload: () => Promise<void>;
  /** False on sections that display assist state but don't offer marking
   *  (Best performing, Most viewed). The marker still renders. */
  showControl?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const control = showControl !== false;

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const kindText = Array.isArray(assistKinds)
    ? assistKinds.map((k) => INTERVENTION_LABELS[k as Intervention["kind"]] ?? k).join(", ")
    : assistKinds
      ? String(assistKinds)
          .split(",")
          .map((k) => INTERVENTION_LABELS[k.trim() as Intervention["kind"]] ?? k.trim())
          .join(", ")
      : "";

  const marked = Boolean(assistedFrom);
  if (!marked && !control) return null;

  return (
    <span ref={wrap} style={{ position: "relative", whiteSpace: "nowrap" }}>
      {marked && (
        <span style={{ marginRight: 8 }}>
          <span className="tag">Paid</span>{" "}
          <span>
            assisted from {shortDate(assistedFrom!)}
            {kindText && ` · ${kindText}`}
          </span>
        </span>
      )}
      {control && (
        <button
          className="lnk"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          title={marked ? "Edit paid support" : "Mark this post as paid or clipped"}
        >
          {marked ? "Edit" : "Mark paid"}
        </button>
      )}
      {control && open && (
        <AssistPopover
          externalId={externalId}
          publishedAt={publishedAt}
          interventions={interventions}
          reload={reload}
          onClose={() => setOpen(false)}
        />
      )}
    </span>
  );
}

function AssistPopover({
  externalId,
  publishedAt,
  interventions,
  reload,
  onClose,
}: {
  externalId: string;
  publishedAt: string;
  interventions: Intervention[];
  reload: () => Promise<void>;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<string>("meta_ads");
  const [startedOn, setStartedOn] = useState(publishedAt.slice(0, 10));
  const [endedOn, setEndedOn] = useState("");
  const [spend, setSpend] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshed, setRefreshed] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      await addIntervention({
        externalId,
        kind,
        startedOn,
        endedOn: endedOn || null,
        spend: spend ? Number(spend) : null,
        notes: notes.trim() || null,
      });
      // No optimistic score update: the median genuinely moves, and the real
      // number should be what lands on screen.
      await reload();
      setSaved(true);
      setSpend("");
      setNotes("");
      setEndedOn("");
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    setErr(null);
    try {
      await removeIntervention(id);
      await reload();
      setSaved(true);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    setRefreshing(true);
    try {
      await refreshDerived();
      setRefreshed(true);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-label="Paid support"
      style={{
        position: "absolute",
        // The control sits at the left of the row, so the popover opens
        // rightwards from it. Anchoring right:0 pushed it off the card.
        left: 0,
        top: "calc(100% + 6px)",
        zIndex: 20,
        width: 320,
        maxWidth: "90vw",
        whiteSpace: "normal",
        background: "var(--card)",
        border: "2px solid var(--ink)",
        borderRadius: "var(--r-card)",
        padding: 14,
        textAlign: "left",
      }}
    >
      <div className="eyebrow">
        <span>Paid support</span>
        <button className="btn x" onClick={onClose}>
          Close
        </button>
      </div>

      {interventions.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          {interventions.map((i) => (
            <div
              key={i.id}
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 8,
                padding: "6px 0",
                borderTop: "1px solid var(--line)",
                fontSize: 13,
              }}
            >
              <span>
                <b>{INTERVENTION_LABELS[i.kind] ?? i.kind}</b> from{" "}
                {shortDate(i.started_on)}
                {i.ended_on && ` to ${shortDate(i.ended_on)}`}
                {i.spend !== null && (
                  <>
                    {" · "}
                    <span className="num">
                      {i.currency === "GBP" || !i.currency ? "£" : ""}
                      {i.spend}
                    </span>
                  </>
                )}
                {i.notes && (
                  <span style={{ color: "var(--muted)" }}> — {i.notes}</span>
                )}
              </span>
              <button
                className="lnk"
                disabled={busy}
                onClick={() => remove(i.id)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Always visible, not just on the first mark. */}
      <p className="note" style={{ marginTop: 0 }}>
        Marking a post as paid removes it from this account&rsquo;s median, so
        other posts&rsquo; scores will move.
      </p>

      <form onSubmit={submit} style={{ marginTop: 10 }}>
        <label className="f" style={{ marginBottom: 8 }}>
          <span>Kind</span>
          <select
            className="f"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            required
          >
            {INTERVENTION_KINDS.map((k) => (
              <option key={k} value={k}>
                {INTERVENTION_LABELS[k]}
              </option>
            ))}
          </select>
        </label>

        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <label className="f" style={{ flex: 1 }}>
            <span>Started</span>
            <input
              className="f"
              type="date"
              value={startedOn}
              onChange={(e) => setStartedOn(e.target.value)}
              required
            />
          </label>
          <label className="f" style={{ flex: 1 }}>
            <span>Ended</span>
            <input
              className="f"
              type="date"
              value={endedOn}
              onChange={(e) => setEndedOn(e.target.value)}
            />
          </label>
        </div>

        <label className="f" style={{ marginBottom: 8 }}>
          <span>Spend</span>
          <input
            className="f"
            type="number"
            min="0"
            step="0.01"
            value={spend}
            onChange={(e) => setSpend(e.target.value)}
            placeholder="£"
          />
        </label>

        <label className="f" style={{ marginBottom: 10 }}>
          <span>Notes</span>
          <input
            className="f"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional"
          />
        </label>

        {err && <p className="err-line">{err}</p>}

        <button className="btn solid" type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
      </form>

      {saved && (
        <>
          <hr className="r" />
          <p className="note" style={{ marginTop: 0 }}>
            The board and brand pages are updated. Share links read the
            materialized view and won&rsquo;t reflect this until the 03:30
            refresh.
          </p>
          {refreshed ? (
            <p className="note">
              <b>Share pages refreshed.</b>
            </p>
          ) : (
            <button className="btn" disabled={refreshing} onClick={refresh}>
              {refreshing ? "Refreshing…" : "Refresh share pages now"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
