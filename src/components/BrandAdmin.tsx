import { useState, type FormEvent } from "react";
import { addBrand, addLabel, setBrandActive, setBrandLabel } from "../lib/data";
import { brandPath, navigate } from "../lib/router";
import type { Brand, Label } from "../lib/types";

const inputCls =
  "w-full border-b border-line bg-transparent pb-1 text-sm outline-none placeholder:text-dim/60 focus:border-ink";

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
      className="fixed inset-0 z-10 flex justify-end bg-ink/20"
      onClick={props.onClose}
    >
      <div
        className="h-full w-full max-w-md overflow-y-auto border-l border-line bg-paper px-7 py-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="font-serif text-2xl">Brands</h2>
          <button
            className="text-[13px] text-dim hover:text-ink"
            onClick={props.onClose}
          >
            Close
          </button>
        </div>

        {err && <p className="mb-4 text-sm text-accent">{err}</p>}

        <ul className="mb-10 divide-y divide-line">
          {props.brands.map((b) => (
            <li key={b.id} className="py-3 text-sm">
              <div className="flex items-baseline justify-between">
                <span className={b.active ? "" : "text-dim line-through"}>
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
                  <span className="ml-2 text-xs text-dim">
                    {b.brand_type} · {b.metricool_blog_id}
                  </span>
                </span>
                <button
                  className="text-xs text-dim underline underline-offset-2 hover:text-ink"
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
                        className={`flex items-center gap-1.5 text-xs ${on ? "text-ink" : "text-dim"}`}
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
        </ul>

        <div className="mb-10">
          <h3 className="mb-3 text-[11px] font-medium uppercase tracking-[0.2em] text-dim">
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
                className="shrink-0 rounded-full bg-ink px-4 py-1 text-[13px] text-paper hover:opacity-90"
              >
                Add
              </button>
              <button
                type="button"
                className="shrink-0 text-[13px] text-dim hover:text-ink"
                onClick={() => setShowNewLabel(false)}
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              className="text-[13px] text-dim underline underline-offset-2 hover:text-ink"
              onClick={() => setShowNewLabel(true)}
            >
              New label
            </button>
          )}
        </div>

        <h3 className="mb-3 text-[11px] font-medium uppercase tracking-[0.2em] text-dim">
          Add brand
        </h3>
        <form onSubmit={submit} noValidate className="space-y-4">
          <div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className={inputCls}
            />
            {fieldErr.name && (
              <p className="mt-1.5 text-[13px] text-accent">{fieldErr.name}</p>
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
            <p className="mt-1.5 text-[13px] leading-relaxed text-dim">
              Open the brand in Metricool — it's the number after{" "}
              <span className="font-medium">blogId=</span> in the URL.
            </p>
            {fieldErr.blogId && (
              <p className="mt-1 text-[13px] text-accent">{fieldErr.blogId}</p>
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
            className="rounded-full bg-ink px-5 py-1.5 text-[13px] text-paper hover:opacity-90"
          >
            Add
          </button>
        </form>
      </div>
    </div>
  );
}
