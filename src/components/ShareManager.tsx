import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createShare, listShares, revokeShare } from "../lib/data";
import { shortDate } from "../lib/format";
import type { ShareLink } from "../lib/types";

const inputCls =
  "f";

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
      className="lnk"
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
        className="lnk"
        onClick={() => setOpen(true)}
      >
        Share this page
      </button>
    );
  }

  return (
    <div className="card">
      <div className="flex items-baseline justify-between">
        <h3 className="lab-mono">
          Share links
        </h3>
        <button
          className="btn x"
          onClick={() => setOpen(false)}
        >
          Close
        </button>
      </div>

      <p className="note">
        A share link shows this account's figures only, with no sign-in —
        anyone who has the link can open it. Send it to the artist or their
        manager; don't use it for anything confidential. Paid support, spend
        and internal notes are never included. Revoking a link kills it
        immediately.
      </p>

      {err && <p className="err-line">{err}</p>}

      {justCreated && (
        <div className="rowhead">
          <span className="min-w-0 flex-1 truncate text-sm">
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
        <label className="f" style={{display:"flex",alignItems:"center",gap:8}}>
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
          className="btn solid"
        >
          {busy ? "Creating…" : "Create link"}
        </button>
      </form>

      {active.length > 0 && (
        <div>
          {active.map((l) => (
            <li key={l.id} className="flex items-center gap-3 py-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">
                  {l.label || "Untitled link"}
                </span>
                <span className="when" style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                  {shareUrl(l.token)}
                </span>
                <span className="when">
                  Created {shortDate(l.created_at)} ·{" "}
                  {l.expires_on
                    ? `expires ${shortDate(l.expires_on)}`
                    : "no expiry"}
                </span>
              </span>
              <CopyButton url={shareUrl(l.token)} />
              <button
                className="lnk"
                onClick={() => revoke(l.id)}
              >
                Revoke
              </button>
            </li>
          ))}
        </div>
      )}

      {inactive.length > 0 && (
        <p className="note">
          {inactive.length} revoked or expired link
          {inactive.length > 1 ? "s" : ""} for this brand.
        </p>
      )}

      {links.length === 0 && (
        <p className="note">No share links yet.</p>
      )}
    </div>
  );
}
