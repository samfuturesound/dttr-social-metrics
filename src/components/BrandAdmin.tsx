import { useState, type FormEvent } from "react";
import { addBrand, setBrandActive } from "../lib/data";
import type { Brand } from "../lib/types";

const inputCls =
  "rounded border border-edge bg-surface px-2 py-1.5 text-sm outline-none focus:border-dim";

export default function BrandAdmin(props: {
  brands: Brand[];
  email: string;
  onClose: () => void;
  reload: () => Promise<void>;
}) {
  const [err, setErr] = useState<string | null>(null);
  const [blogId, setBlogId] = useState("");
  const [name, setName] = useState("");
  const [brandType, setBrandType] = useState("theme");
  const [owner, setOwner] = useState("");
  const [niche, setNiche] = useState("");

  function run(fn: () => Promise<void>) {
    setErr(null);
    fn()
      .then(props.reload)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    run(() =>
      addBrand({
        metricoolBlogId: Number(blogId),
        name: name.trim(),
        brandType,
        owner: owner.trim() || props.email,
        niche: niche.trim() || null,
      }),
    );
    setBlogId("");
    setName("");
    setNiche("");
  }

  return (
    <div
      className="fixed inset-0 z-10 flex justify-end bg-black/60"
      onClick={props.onClose}
    >
      <div
        className="h-full w-full max-w-md overflow-y-auto border-l border-edge bg-panel p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Brands</h2>
          <button className="text-sm text-dim hover:text-ink" onClick={props.onClose}>
            Close
          </button>
        </div>

        {err && <p className="mb-3 text-sm text-red-400">{err}</p>}

        <ul className="mb-6 space-y-1.5">
          {props.brands.map((b) => (
            <li
              key={b.id}
              className="flex items-center justify-between rounded border border-edge px-3 py-2 text-sm"
            >
              <span className={b.active ? "" : "text-dim line-through"}>
                {b.name}
                <span className="ml-2 text-xs text-dim">
                  {b.brand_type} · {b.metricool_blog_id}
                </span>
              </span>
              <button
                className="text-xs text-dim underline hover:text-ink"
                onClick={() => run(() => setBrandActive(b.id, !b.active))}
              >
                {b.active ? "deactivate" : "activate"}
              </button>
            </li>
          ))}
        </ul>

        <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-dim">
          Add brand
        </h3>
        <form onSubmit={submit} className="space-y-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            required
            className={`w-full ${inputCls}`}
          />
          <input
            value={blogId}
            onChange={(e) => setBlogId(e.target.value)}
            placeholder="Metricool blog id"
            type="number"
            required
            className={`w-full ${inputCls}`}
          />
          <div className="flex gap-2">
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
              placeholder="Owner (defaults to you)"
              className={`flex-1 ${inputCls}`}
            />
          </div>
          <input
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            placeholder="Niche (theme brands)"
            className={`w-full ${inputCls}`}
          />
          <button
            type="submit"
            className="rounded border border-edge px-3 py-1.5 text-sm hover:bg-edge"
          >
            Add
          </button>
        </form>
      </div>
    </div>
  );
}
