import { useRef, useState, type FormEvent } from "react";
import {
  addIntervention,
  addNote,
  removeIntervention,
  uploadStreamingCapture,
} from "../lib/data";
import { compact, shortDate } from "../lib/format";
import {
  INTERVENTION_KINDS,
  INTERVENTION_LABELS,
  type FlaggedPost,
  type Intervention,
  type PostNote,
  type StreamingCapture,
} from "../lib/types";

const inputCls =
  "border-b border-line bg-transparent pb-1 text-sm outline-none placeholder:text-dim/60 focus:border-ink";

export default function PostDetail(props: {
  post: FlaggedPost;
  notes: PostNote[];
  interventions: Intervention[];
  streaming: StreamingCapture[];
  reload: () => Promise<void>;
}) {
  const { post, reload } = props;
  const [err, setErr] = useState<string | null>(null);

  function run(fn: () => Promise<void>) {
    setErr(null);
    fn()
      .then(reload)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }

  return (
    <div className="space-y-6 pb-8 pl-25 pr-2 text-sm max-sm:pl-0">
      {err && <p className="text-accent">{err}</p>}
      <Notes
        notes={props.notes}
        onAdd={(note) => run(() => addNote(post.external_id, note))}
      />
      <Boosts
        interventions={props.interventions}
        onAdd={(a) =>
          run(() => addIntervention({ ...a, externalId: post.external_id }))
        }
        onRemove={(id) => run(() => removeIntervention(id))}
      />
      <Streaming
        captures={props.streaming}
        externalId={post.external_id}
        onDone={() => run(async () => {})}
        onError={setErr}
      />
    </div>
  );
}

function Heading({ children }: { children: string }) {
  return (
    <h3 className="mb-2 text-[11px] font-medium uppercase tracking-[0.2em] text-dim">
      {children}
    </h3>
  );
}

function Notes(props: { notes: PostNote[]; onAdd: (note: string) => void }) {
  const [text, setText] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    props.onAdd(t);
    setText("");
  }
  return (
    <section>
      <Heading>Notes</Heading>
      {props.notes.map((n) => (
        <p key={n.id} className="mb-1.5">
          {n.note}{" "}
          <span className="text-xs text-dim">— {shortDate(n.created_at)}</span>
        </p>
      ))}
      <form onSubmit={submit} className="mt-1 flex items-end gap-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What made this land?"
          className={`flex-1 ${inputCls}`}
        />
        <button className="text-[13px] text-dim underline underline-offset-2 hover:text-ink" type="submit">
          Add
        </button>
      </form>
    </section>
  );
}

function Boosts(props: {
  interventions: Intervention[];
  onAdd: (a: {
    kind: string;
    startedOn: string;
    endedOn: string | null;
    spend: number | null;
    notes: string | null;
  }) => void;
  onRemove: (id: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [kind, setKind] = useState<string>("meta_ads");
  const [startedOn, setStartedOn] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [spend, setSpend] = useState("");
  const [notes, setNotes] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    props.onAdd({
      kind,
      startedOn,
      endedOn: null,
      spend: spend ? Number(spend) : null,
      notes: notes.trim() || null,
    });
    setShowForm(false);
    setSpend("");
    setNotes("");
  }

  return (
    <section>
      <Heading>Paid support</Heading>
      {props.interventions.map((i) => (
        <p key={i.id} className="mb-1.5">
          {INTERVENTION_LABELS[i.kind] ?? i.kind} from {shortDate(i.started_on)}
          {i.spend !== null && ` · £${i.spend}`}
          {i.notes && <span className="text-dim"> — {i.notes}</span>}{" "}
          <button
            className="text-xs text-dim underline underline-offset-2 hover:text-accent"
            onClick={() => props.onRemove(i.id)}
          >
            remove
          </button>
        </p>
      ))}
      {showForm ? (
        <form onSubmit={submit} className="mt-2 flex flex-wrap items-end gap-4">
          <select value={kind} onChange={(e) => setKind(e.target.value)} className={inputCls}>
            {INTERVENTION_KINDS.map((k) => (
              <option key={k} value={k}>
                {INTERVENTION_LABELS[k]}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={startedOn}
            onChange={(e) => setStartedOn(e.target.value)}
            className={inputCls}
            required
          />
          <input
            type="number"
            min="0"
            step="0.01"
            value={spend}
            onChange={(e) => setSpend(e.target.value)}
            placeholder="Spend £"
            className={`w-20 ${inputCls}`}
          />
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes"
            className={`min-w-32 flex-1 ${inputCls}`}
          />
          <button
            className="rounded-full bg-ink px-4 py-1 text-[13px] text-paper hover:opacity-90"
            type="submit"
          >
            Save
          </button>
          <button
            type="button"
            className="text-[13px] text-dim hover:text-ink"
            onClick={() => setShowForm(false)}
          >
            Cancel
          </button>
        </form>
      ) : (
        <button
          className="text-[13px] text-dim underline underline-offset-2 hover:text-ink"
          onClick={() => setShowForm(true)}
        >
          Mark as boosted / clipped
        </button>
      )}
    </section>
  );
}

function Streaming(props: {
  captures: StreamingCapture[];
  externalId: string;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      await uploadStreamingCapture(props.externalId, file);
      props.onDone();
    } catch (e) {
      props.onError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <section>
      <Heading>Spotify impact</Heading>
      {props.captures.map((c) => (
        <p key={c.id} className="mb-1.5">
          {c.track_name ?? "Unknown track"}
          {c.captured_on && ` · ${shortDate(c.captured_on)}`}
          {c.period_label && ` · ${c.period_label}`}: {compact(c.streams)}{" "}
          streams, {compact(c.listeners)} listeners
          {c.pct_active !== null && `, ${Math.round(c.pct_active)}% active`}
        </p>
      ))}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <button
        className="text-[13px] text-dim underline underline-offset-2 hover:text-ink disabled:opacity-50"
        disabled={busy}
        onClick={() => fileRef.current?.click()}
      >
        {busy ? "Reading screenshot…" : "Upload Spotify screenshot"}
      </button>
    </section>
  );
}
