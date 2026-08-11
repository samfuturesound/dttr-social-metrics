import { useState, type FormEvent } from "react";
import { addBrand, setBrandActive } from "../lib/data";
import { brandPath, navigate } from "../lib/router";
import type { Brand } from "../lib/types";

const inputCls =
  "w-full border-b border-line bg-transparent pb-1 text-sm outline-none placeholder:text-dim/60 focus:border-ink";

export default function BrandAdmin(props: {
  brands: Brand[];
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
            <li key={b.id} className="flex items-baseline justify-between py-2.5 text-sm">
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
            </li>
          ))}
        </ul>

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
