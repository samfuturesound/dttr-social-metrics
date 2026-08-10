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

export default function Dashboard({ email }: { email: string }) {
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
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <header className="mb-8 flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">DTTR Social</h1>
          <p className="text-sm text-dim">{todayLabel()}</p>
        </div>
        <div className="flex items-center gap-3 text-sm text-dim">
          {MOCK && (
            <span className="rounded bg-hot/15 px-2 py-0.5 text-xs font-medium text-hot">
              mock data
            </span>
          )}
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
        </div>
      </header>

      {error && (
        <div className="mb-6 rounded-md border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {posts === null && !error && (
        <p className="py-24 text-center text-sm text-dim">Loading…</p>
      )}

      {posts !== null && posts.length === 0 && (
        <div className="py-28 text-center">
          <p className="text-2xl font-medium text-good">All quiet.</p>
          <p className="mt-2 text-sm text-dim">
            Nothing is beating its baseline this morning
            {activeBrands > 0 ? ` across ${activeBrands} active brands` : ""}.
            No action needed.
          </p>
        </div>
      )}

      {posts !== null && posts.length > 0 && (
        <div className="grid gap-10 lg:grid-cols-2">
          <Group
            title="Artists"
            posts={artists}
            {...{ notes, interventions, streaming, email, openId, setOpenId }}
            reload={load}
          />
          <Group
            title="Theme accounts"
            posts={themes}
            {...{ notes, interventions, streaming, email, openId, setOpenId }}
            reload={load}
          />
        </div>
      )}

      {adminOpen && (
        <BrandAdmin
          brands={brands}
          email={email}
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
  email: string;
  openId: string | null;
  setOpenId: (id: string | null) => void;
  reload: () => Promise<void>;
}) {
  const { title, posts } = props;
  return (
    <section>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-dim">
        {title}
        {posts.length > 0 && (
          <span className="ml-2 font-normal">{posts.length}</span>
        )}
      </h2>
      {posts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-edge px-4 py-6 text-sm text-dim">
          Nothing flagged.
        </p>
      ) : (
        <ul className="space-y-2">
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
              email={props.email}
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
