import { useState, type FormEvent } from "react";
import { addBrand, addLabel, setBrandActive, setBrandLabel } from "../lib/data";
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
        <div className="mb-6 flex items-baseline justify-between">
          <h2 style={{fontSize:22}}>Brands</h2>
          <button
            className="btn x"
            onClick={props.onClose}
          >
            Close
          </button>
        </div>

        {err && <p className="err-line">{err}</p>}

        <div style={{marginBottom:24}}>
          {props.brands.map((b) => (
            <li key={b.id} className="py-3 text-sm">
              <div className="flex items-baseline justify-between">
                <span style={b.active ? undefined : {color:"var(--muted)",textDecoration:"line-through"}}>
                  <a
                    href={brandPath(b.name)}
                    onClick={(e) => {
                      e.preventDefault();
                      props.onClose();
                      navigate(brandPath(b.name));
                    }}
                    className="hover:underline"
                  >
                    {b.name}
                  </a>
                  <span className="note" style={{marginTop:0}}>
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
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
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
            </li>
          ))}
        </div>

        <div className="mb-10">
          <h3 className="lab-mono">
            Labels
          </h3>
          {showNewLabel ? (
            <form
              className="flex items-end gap-3"
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
          <div className="flex gap-4">
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
