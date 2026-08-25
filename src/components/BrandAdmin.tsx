import { useState, type FormEvent } from "react";
import {
  addBrand,
  addLabel,
  refreshDerived,
  setBrandActive,
  setBrandLabel,
} from "../lib/data";
import { brandPath, navigate } from "../lib/router";
import type { Brand, Label } from "../lib/types";

const inputCls =
  "f";

export default function BrandAdmin(props: {
  brands: Brand[];
  labels: Label[];
  onClose: () => void;
  reload: () => Promise<void>;
}) {
  const [err, setErr] = useState<string | null>(null);
  const [blogId, setBlogId] = useState("");
  const [name, setName] = useState("");
  const [brandType, setBrandType] = useState("theme");
  const [owner, setOwner] = useState("");
  const [niche, setNiche] = useState("");
  const [fieldErr, setFieldErr] = useState<{ name?: string; blogId?: string }>(
    {},
  );
  const [newLabel, setNewLabel] = useState("");
  const [showNewLabel, setShowNewLabel] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);

  /**
   * Rebuild post_detail_mv now rather than waiting for the 03:30 cron. A brand
   * added today has no rows in the materialized view until then, so a share
   * link made the same day renders empty.
   */
  async function refreshNow() {
    setErr(null);
    setRefreshing(true);
    try {
      await refreshDerived();
      setRefreshedAt(
        new Date().toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
      await props.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshing(false);
    }
  }

  function run(fn: () => Promise<void>) {
    setErr(null);
    fn()
      .then(props.reload)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const errs: { name?: string; blogId?: string } = {};
    if (!name.trim()) errs.name = "Give the brand a name.";
    if (!blogId.trim()) {
      errs.blogId = "The blog id is needed to match Metricool's data.";
    } else if (!/^\d+$/.test(blogId.trim())) {
      errs.blogId = "The blog id is just the number from the URL.";
    }
    setFieldErr(errs);
    if (Object.keys(errs).length > 0) return;
    run(() =>
      addBrand({
        metricoolBlogId: blogId.trim(),
        name: name.trim(),
        brandType,
        owner: owner.trim(),
        niche: niche.trim() || null,
      }),
    );
    setBlogId("");
    setName("");
    setNiche("");
  }

  return (
    <div
      style={{position:"fixed",inset:0,zIndex:10,display:"flex",justifyContent:"flex-end",background:"rgba(26,28,34,0.28)"}}
      onClick={props.onClose}
    >
      <div
        style={{height:"100%",width:"100%",maxWidth:440,overflowY:"auto",borderLeft:"2px solid var(--line)",background:"var(--page)",padding:"20px"}}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 16 }}>
          <h2 style={{fontSize:22}}>Brands</h2>
          <button
            className="btn x"
            onClick={props.onClose}
          >
            Close
          </button>
        </div>

        {err && <p className="err-line">{err}</p>}

        <div className="card">
          <div className="eyebrow">
            <span>After adding a brand</span>
          </div>
          <p className="note" style={{ marginTop: 0 }}>
            A new brand&rsquo;s posts don&rsquo;t reach the share pages until the
            overnight update at 03:30. Refresh now to make them appear
            immediately — it takes about a second.
          </p>
          <div
            style={{
              marginTop: 12,
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <button className="btn" onClick={refreshNow} disabled={refreshing}>
              {refreshing ? "Refreshing…" : "Refresh now"}
            </button>
            {refreshedAt && (
              <span className="note" style={{ marginTop: 0 }}>
                Refreshed at <b>{refreshedAt}</b>
              </span>
            )}
          </div>
        </div>

        <div style={{marginBottom:24}}>
          {props.brands.map((b) => (
            <div key={b.id} style={{ padding: "10px 0", borderTop: "1px solid var(--line)", fontSize: 13 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                <span style={b.active ? undefined : {color:"var(--muted)",textDecoration:"line-through"}}>
                  <a
                    href={brandPath(b.name)}
                    onClick={(e) => {
                      e.preventDefault();
                      props.onClose();
                      navigate(brandPath(b.name));
                    }}
                    style={{ color: "inherit", fontWeight: 700 }}
                  >
                    {b.name}
                  </a>
                  <span
                    className="note"
                    style={{ marginTop: 2, display: "block", fontSize: 12 }}
                  >
                    {b.brand_type} · {b.metricool_blog_id}
                  </span>
                </span>
                <button
                  className="lnk"
                  onClick={() => run(() => setBrandActive(b.id, !b.active))}
                >
                  {b.active ? "deactivate" : "activate"}
                </button>
              </div>
              {/* Labels are many-to-many — every label is a checkbox, and a
                  brand can carry any number of them. */}
              {props.labels.length > 0 && (
                <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: "6px 14px" }}>
                  {props.labels.map((l) => {
                    const on = (b.labels ?? []).includes(l.name);
                    return (
                      <label
                        key={l.label_id}
                        style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:on?"var(--ink)":"var(--muted)"}}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={(e) =>
                            run(() =>
                              setBrandLabel(b.id, l.name, e.target.checked),
                            )
                          }
                        />
                        {l.name}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ marginBottom: 24 }}>
          <h3 className="lab-mono">
            Labels
          </h3>
          {showNewLabel ? (
            <form
              style={{ display: "flex", alignItems: "flex-end", gap: 10 }}
              onSubmit={(e) => {
                e.preventDefault();
                const n = newLabel.trim();
                if (!n) return;
                run(() => addLabel(n));
                setNewLabel("");
                setShowNewLabel(false);
              }}
            >
              <input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Label name"
                autoFocus
                className={inputCls}
              />
              <button
                type="submit"
                className="btn solid"
              >
                Add
              </button>
              <button
                type="button"
                className="btn x"
                onClick={() => setShowNewLabel(false)}
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              className="lnk"
              onClick={() => setShowNewLabel(true)}
            >
              New label
            </button>
          )}
        </div>

        <h3 className="lab-mono">
          Add brand
        </h3>
        <form onSubmit={submit} noValidate>
          <div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className={inputCls}
            />
            {fieldErr.name && (
              <p className="err-line">{fieldErr.name}</p>
            )}
          </div>
          <div>
            <input
              value={blogId}
              onChange={(e) => setBlogId(e.target.value)}
              placeholder="Metricool blog id"
              inputMode="numeric"
              className={inputCls}
            />
            <p className="note">
              Open the brand in Metricool — it's the number after{" "}
              <span className="font-medium">blogId=</span> in the URL.
            </p>
            {fieldErr.blogId && (
              <p className="err-line">{fieldErr.blogId}</p>
            )}
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <select
              value={brandType}
              onChange={(e) => setBrandType(e.target.value)}
              className={`flex-1 ${inputCls}`}
            >
              <option value="artist">artist</option>
              <option value="theme">theme</option>
            </select>
            <input
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              placeholder="Owner"
              className={`flex-1 ${inputCls}`}
            />
          </div>
          <input
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            placeholder="Niche (theme brands)"
            className={inputCls}
          />
          <button
            type="submit"
            className="btn solid"
          >
            Add
          </button>
        </form>
      </div>
    </div>
  );
}
