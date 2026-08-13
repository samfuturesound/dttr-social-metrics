import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  createLabelShare,
  listLabelShares,
  revokeLabelShare,
} from "../lib/data";
import { shortDate } from "../lib/format";
import type { LabelShareLink } from "../lib/types";

const inputCls =
  "border-b border-line bg-transparent pb-1 text-sm outline-none placeholder:text-dim/60 focus:border-ink";

function defaultExpiry(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 6);
  return d.toISOString().slice(0, 10);
}

function labelShareUrl(token: string): string {
  return `${location.origin}/share/label/${token}`;
}

function CopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="shrink-0 text-[13px] text-dim underline underline-offset-2 hover:text-ink"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export default function LabelShareManager({
  labelName,
}: {
  labelName: string;
}) {
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState<LabelShareLink[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [expires, setExpires] = useState(defaultExpiry());
  const [noExpiry, setNoExpiry] = useState(false);
  const [busy, setBusy] = useState(false);
  const [justCreated, setJustCreated] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const all = await listLabelShares();
      setLinks(all.filter((l) => l.label === labelName));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, [labelName]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const token = await createLabelShare({
        label: labelName,
        note: note.trim() || null,
        expiresOn: noExpiry ? null : expires,
      });
      setJustCreated(token);
      setNote("");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: number) {
    setErr(null);
    try {
      await revokeLabelShare(id);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const active = links.filter(
    (l) => !l.revoked && (!l.expires_on || l.expires_on >= today),
  );
  const inactive = links.filter((l) => !active.includes(l));

  if (!open) {
    return (
      <button
        className="mt-4 text-[13px] text-dim underline underline-offset-2 hover:text-ink"
        onClick={() => setOpen(true)}
      >
        Share this label
      </button>
    );
  }

  return (
    <div className="mt-6 max-w-2xl border-t border-line pt-5">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.2em] text-dim">
          Share links
        </h3>
        <button
          className="text-[13px] text-dim hover:text-ink"
          onClick={() => setOpen(false)}
        >
          Close
        </button>
      </div>

      <p className="mt-3 max-w-prose text-[13px] leading-relaxed text-dim">
        A share link shows every brand under {labelName}, with no sign-in —
        anyone who has the link can open it. Send it to the label; don't use it
        for anything confidential. Paid support, spend, internal notes and
        roster rankings are never included. Revoking a link kills it
        immediately.
      </p>

      {err && <p className="mt-3 text-sm text-accent">{err}</p>}

      {justCreated && (
        <div className="mt-4 flex items-center gap-3 border-b border-line pb-2">
          <span className="min-w-0 flex-1 truncate font-serif text-sm">
            {labelShareUrl(justCreated)}
          </span>
          <CopyButton url={labelShareUrl(justCreated)} />
        </div>
      )}

      <form onSubmit={submit} className="mt-5 flex flex-wrap items-end gap-4">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={`Note, e.g. "${labelName} A&R"`}
          className={`min-w-56 flex-1 ${inputCls}`}
        />
        <label className="flex items-center gap-2 text-[13px] text-dim">
          <input
            type="checkbox"
            checked={noExpiry}
            onChange={(e) => setNoExpiry(e.target.checked)}
          />
          No expiry
        </label>
        {!noExpiry && (
          <input
            type="date"
            value={expires}
            onChange={(e) => setExpires(e.target.value)}
            className={inputCls}
          />
        )}
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-ink px-4 py-1 text-[13px] text-paper hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create link"}
        </button>
      </form>

      {active.length > 0 && (
        <ul className="mt-6 divide-y divide-line">
          {active.map((l) => (
            <li key={l.id} className="flex items-center gap-3 py-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">
                  {l.note || "Untitled link"}
                </span>
                <span className="mt-0.5 block truncate text-[13px] text-dim">
                  {labelShareUrl(l.token)}
                </span>
                <span className="mt-0.5 block text-xs text-dim">
                  Created {shortDate(l.created_at)} ·{" "}
                  {l.expires_on
                    ? `expires ${shortDate(l.expires_on)}`
                    : "no expiry"}
                </span>
              </span>
              <CopyButton url={labelShareUrl(l.token)} />
              <button
                className="shrink-0 text-[13px] text-dim underline underline-offset-2 hover:text-accent"
                onClick={() => revoke(l.id)}
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}

      {inactive.length > 0 && (
        <p className="mt-4 text-[13px] text-dim">
          {inactive.length} revoked or expired link
          {inactive.length > 1 ? "s" : ""} for this label.
        </p>
      )}

      {links.length === 0 && (
        <p className="mt-5 text-[13px] text-dim">No share links yet.</p>
      )}
    </div>
  );
}
