import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, MOCK } from "../lib/supabase";
import {
  fetchBrands,
  fetchFlagged,
  fetchInterventions,
  fetchNotes,
  fetchStreaming,
} from "../lib/data";
import { todayLabel } from "../lib/format";
import type {
  Brand,
  FlaggedPost,
  Intervention,
  PostNote,
  StreamingCapture,
} from "../lib/types";
import PostRow from "./PostRow";
import BrandAdmin from "./BrandAdmin";

export default function Dashboard() {
  const [posts, setPosts] = useState<FlaggedPost[] | null>(null);
  const [notes, setNotes] = useState<PostNote[]>([]);
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [streaming, setStreaming] = useState<StreamingCapture[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [flagged, allBrands] = await Promise.all([
        fetchFlagged(),
        fetchBrands(),
      ]);
      setPosts(flagged);
      setBrands(allBrands);
      const ids = flagged.map((p) => p.external_id);
      const [n, i, s] = await Promise.all([
        fetchNotes(ids),
        fetchInterventions(ids),
        fetchStreaming(ids),
      ]);
      setNotes(n);
      setInterventions(i);
      setStreaming(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const artists = useMemo(
    () => (posts ?? []).filter((p) => p.brand_type === "artist"),
    [posts],
  );
  const themes = useMemo(
    () => (posts ?? []).filter((p) => p.brand_type === "theme"),
    [posts],
  );
  const activeBrands = brands.filter((b) => b.active).length;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 sm:px-10">
      <header className="mb-12">
        <div className="flex items-baseline justify-between">
          <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-dim">
            Dance to the Radio
            {MOCK && <span className="ml-3 text-accent">mock data</span>}
          </p>
          <nav className="flex gap-5 text-[13px] text-dim">
            <button className="hover:text-ink" onClick={() => setAdminOpen(true)}>
              Brands
            </button>
            {!MOCK && (
              <button
                className="hover:text-ink"
                onClick={() => supabase.auth.signOut()}
              >
                Sign out
              </button>
            )}
          </nav>
        </div>
        <h1 className="mt-3 font-serif text-4xl tracking-tight">
          {todayLabel()}
        </h1>
      </header>

      {error && <p className="mb-8 text-sm text-accent">{error}</p>}

      {posts === null && !error && (
        <p className="py-24 text-center text-sm text-dim">Loading…</p>
      )}

      {posts !== null && posts.length === 0 && (
        <div className="py-28 text-center">
          <p className="font-serif text-4xl">All quiet.</p>
          <p className="mt-3 text-sm text-dim">
            Nothing is beating its baseline this morning
            {activeBrands > 0 ? ` across ${activeBrands} active brands` : ""}.
          </p>
        </div>
      )}

      {posts !== null && posts.length > 0 && (
        <div className="grid gap-x-14 gap-y-12 lg:grid-cols-2">
          <Group
            title="Artists"
            posts={artists}
            {...{ notes, interventions, streaming, openId, setOpenId }}
            reload={load}
          />
          <Group
            title="Theme accounts"
            posts={themes}
            {...{ notes, interventions, streaming, openId, setOpenId }}
            reload={load}
          />
        </div>
      )}

      {adminOpen && (
        <BrandAdmin
          brands={brands}
          onClose={() => setAdminOpen(false)}
          reload={load}
        />
      )}
    </div>
  );
}

function Group(props: {
  title: string;
  posts: FlaggedPost[];
  notes: PostNote[];
  interventions: Intervention[];
  streaming: StreamingCapture[];
  openId: string | null;
  setOpenId: (id: string | null) => void;
  reload: () => Promise<void>;
}) {
  const { title, posts } = props;
  return (
    <section>
      <h2 className="border-b border-line pb-2 text-[11px] font-medium uppercase tracking-[0.2em] text-dim">
        {title}
        {posts.length > 0 && (
          <span className="ml-2 font-normal text-dim/70">{posts.length}</span>
        )}
      </h2>
      {posts.length === 0 ? (
        <p className="pt-6 text-sm text-dim">Nothing flagged.</p>
      ) : (
        <ul className="divide-y divide-line">
          {posts.map((p) => (
            <PostRow
              key={p.external_id}
              post={p}
              notes={props.notes.filter(
                (n) => n.external_id === p.external_id,
              )}
              interventions={props.interventions.filter(
                (i) => i.external_id === p.external_id,
              )}
              streaming={props.streaming.filter(
                (s) => s.triggered_by_external_id === p.external_id,
              )}
              open={props.openId === p.external_id}
              onToggle={() =>
                props.setOpenId(
                  props.openId === p.external_id ? null : p.external_id,
                )
              }
              reload={props.reload}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
