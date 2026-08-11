import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createShare, listShares, revokeShare } from "../lib/data";
import { shortDate } from "../lib/format";
import type { ShareLink } from "../lib/types";

const inputCls =
  "border-b border-line bg-transparent pb-1 text-sm outline-none placeholder:text-dim/60 focus:border-ink";

/** Six months out, as YYYY-MM-DD — the default expiry for a new link. */
function defaultExpiry(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 6);
  return d.toISOString().slice(0, 10);
}

function shareUrl(token: string): string {
  return `${location.origin}/share/${token}`;
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

export default function ShareManager(props: {
  brandId: number;
  brandName: string;
}) {
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [expires, setExpires] = useState(defaultExpiry());
  const [noExpiry, setNoExpiry] = useState(false);
  const [busy, setBusy] = useState(false);
  const [justCreated, setJustCreated] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const all = await listShares();
      setLinks(all.filter((l) => l.brand_id === props.brandId));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, [props.brandId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const token = await createShare({
        brandId: props.brandId,
        label: label.trim() || null,
        expiresOn: noExpiry ? null : expires,
      });
      setJustCreated(token);
      setLabel("");
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
      await revokeShare(id);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  const active = links.filter(
    (l) =>
      !l.revoked && (!l.expires_on || l.expires_on >= new Date().toISOString().slice(0, 10)),
  );
  const inactive = links.filter((l) => !active.includes(l));

  if (!open) {
    return (
      <button
        className="mt-4 text-[13px] text-dim underline underline-offset-2 hover:text-ink"
        onClick={() => setOpen(true)}
      >
        Share this page
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
        A share link shows this account's figures only, with no sign-in —
        anyone who has the link can open it. Send it to the artist or their
        manager; don't use it for anything confidential. Paid support, spend
        and internal notes are never included. Revoking a link kills it
        immediately.
      </p>

      {err && <p className="mt-3 text-sm text-accent">{err}</p>}

      {justCreated && (
        <div className="mt-4 flex items-center gap-3 border-b border-line pb-2">
          <span className="min-w-0 flex-1 truncate font-serif text-sm">
            {shareUrl(justCreated)}
          </span>
          <CopyButton url={shareUrl(justCreated)} />
        </div>
      )}

      <form onSubmit={submit} className="mt-5 flex flex-wrap items-end gap-4">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={`Label, e.g. "${props.brandName} management"`}
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
                  {l.label || "Untitled link"}
                </span>
                <span className="mt-0.5 block truncate text-[13px] text-dim">
                  {shareUrl(l.token)}
                </span>
                <span className="mt-0.5 block text-xs text-dim">
                  Created {shortDate(l.created_at)} ·{" "}
                  {l.expires_on
                    ? `expires ${shortDate(l.expires_on)}`
                    : "no expiry"}
                </span>
              </span>
              <CopyButton url={shareUrl(l.token)} />
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
          {inactive.length > 1 ? "s" : ""} for this brand.
        </p>
      )}

      {links.length === 0 && (
        <p className="mt-5 text-[13px] text-dim">No share links yet.</p>
      )}
    </div>
  );
}
