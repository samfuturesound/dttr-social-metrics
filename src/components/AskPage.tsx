import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { askAI, fetchAiQueries, fetchBrands } from "../lib/data";
import { shortDate } from "../lib/format";
import { navigate } from "../lib/router";
import type { AiQuery, Brand } from "../lib/types";

const PERIODS = [
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 365, label: "12 months" },
];

const selectCls =
  "border-b border-line bg-transparent pb-1 text-sm outline-none focus:border-ink";

/** A guidance block above the question box. */
function Guide({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="text-[11px] font-medium uppercase tracking-[0.2em] text-dim">
        {title}
      </h2>
      <div className="mt-2 max-w-prose space-y-2 text-sm leading-relaxed text-dim">
        {children}
      </div>
    </div>
  );
}

/**
 * Renders the model's prose. It's asked for plain paragraphs, but it may
 * still return a list or stray markdown emphasis, so handle both without
 * pulling in a markdown dependency.
 */
function Answer({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).filter((b) => b.trim());
  return (
    <div className="max-w-prose space-y-3 text-[15px] leading-relaxed">
      {blocks.map((block, i) => {
        const lines = block.split("\n").filter((l) => l.trim());
        const isList = lines.every((l) => /^\s*[-*·•]\s+/.test(l));
        if (isList) {
          return (
            <ul key={i} className="space-y-1.5 pl-4">
              {lines.map((l, j) => (
                <li key={j} className="list-disc">
                  {strip(l.replace(/^\s*[-*·•]\s+/, ""))}
                </li>
              ))}
            </ul>
          );
        }
        return <p key={i}>{strip(block.replace(/\n/g, " "))}</p>;
      })}
    </div>
  );
}

/** Drop stray markdown emphasis rather than rendering the asterisks. */
function strip(s: string): string {
  return s.replace(/\*\*(.+?)\*\*/g, "$1").replace(/(?<!\*)\*(?!\*)/g, "");
}

export default function AskPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [history, setHistory] = useState<AiQuery[]>([]);
  const [brand, setBrand] = useState<string>("");
  const [days, setDays] = useState(90);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [meta, setMeta] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = () =>
    fetchAiQueries()
      .then(setHistory)
      .catch(() => {
        /* the log is a nicety; never block the page on it */
      });

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchBrands()
      .then((b) => setBrands(b.filter((x) => x.active)))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    loadHistory();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    setError(null);
    setAnswer(null);
    setMeta(null);
    try {
      const res = await askAI({ question: q, brand: brand || null, days });
      setAnswer(res.answer);
      setMeta(
        `${res.posts} post${res.posts === 1 ? "" : "s"} read` +
          (res.truncated ? " · answer cut short by length" : ""),
      );
      loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 sm:px-10">
      <header className="mb-10">
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate("/");
          }}
          className="text-[13px] text-dim underline underline-offset-2 hover:text-ink"
        >
          ← Board
        </a>
        <h1 className="mt-4 font-serif text-4xl tracking-tight">AI Summarise</h1>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-dim">
          Ask a question about the accounts and get an answer drawn from the
          Metricool data behind these pages.
        </p>
      </header>

      <div className="mb-10 grid gap-8 border-y border-line py-8 lg:grid-cols-3">
        <Guide title="What to ask">
          <p>
            It can see every post we've pulled from Metricool — views, likes,
            comments, shares, saves, watch time, skip rate and captions — plus
            each account's medians. Good questions compare things:
          </p>
          <ul className="space-y-1">
            <li>
              How has Tommy Ashby's TikTok performed since the album campaign
              started?
            </li>
            <li>
              Which of L'objectif's reels held attention best, and what did
              they have in common?
            </li>
            <li>
              Compare Far Caspian's engagement on Instagram against TikTok.
            </li>
            <li>What changed for Twin Atlantic in the last month?</li>
          </ul>
        </Guide>

        <Guide title="How to ask it">
          <p>
            Pick one account and one question. The whole roster at once gives
            vaguer answers than a single brand — twelve months of one account
            is a comparison; twelve months of ten accounts is a pile.
          </p>
          <p>
            Name the platform if you care about it. Instagram and TikTok behave
            so differently that a blended answer is usually misleading.
          </p>
          <p>
            Ask it to show its numbers. It'll quote figures you can check
            against the tables, and it's better at spotting patterns than at
            arithmetic.
          </p>
        </Guide>

        <Guide title="What it can't do yet">
          <p>
            It only sees Metricool. It knows nothing about streams, ad spend,
            release dates or what was happening that week — so it can tell you
            a post did well, not why the world responded.
          </p>
          <p>
            Caption and hashtag patterns are not there yet. We tested it:
            across 531 posts, no hashtag used eight or more times predicts
            performance, and caption length and question-vs-statement come out
            completely flat. That's not the AI failing — the posts weren't
            written as experiments, so there's nothing to find. This becomes
            useful once the theme accounts have been deliberately testing
            formats for a few months.
          </p>
          <p>
            Newer accounts have thin data. An account needs ten posts on a
            platform before anything is scored, and the theme accounts have
            barely started.
          </p>
          <p>
            Most of our history was backfilled in one go, so we have each
            post's final figures but not how it grew day by day. Questions
            about how quickly something took off can't be answered yet — that
            only accumulates from August 2026 onwards.
          </p>
          <p>
            And it can misread a number even when the data is right. Treat it
            as a place to start looking, not a source of truth.
          </p>
        </Guide>
      </div>

      <form onSubmit={submit} className="mb-10">
        <div className="mb-5 flex flex-wrap items-end gap-6">
          <label className="flex items-center gap-2 text-[13px] text-dim">
            Account
            <select
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className={selectCls}
            >
              <option value="">All brands</option>
              {brands.map((b) => (
                <option key={b.id} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-[13px] text-dim">
            Period
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className={selectCls}
            >
              {PERIODS.map((p) => (
                <option key={p.days} value={p.days}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit(e);
          }}
          rows={3}
          placeholder="Ask a question about these accounts…"
          className="w-full resize-y border-b border-line bg-transparent pb-2 text-[15px] leading-relaxed outline-none placeholder:text-dim/60 focus:border-ink"
        />

        <div className="mt-4 flex items-center gap-4">
          <button
            type="submit"
            disabled={busy || !question.trim()}
            className="rounded-full bg-ink px-5 py-1.5 text-[13px] text-paper hover:opacity-90 disabled:opacity-40"
          >
            {busy ? "Reading the data…" : "Ask"}
          </button>
          {busy && (
            <span className="text-[13px] text-dim">
              This takes a few seconds — a year of the whole roster is a lot to
              read.
            </span>
          )}
        </div>
      </form>

      {error && (
        <p className="mb-8 max-w-prose text-sm text-accent">{error}</p>
      )}

      {answer && (
        <section className="mb-12">
          <h2 className="border-b border-line pb-2 text-[11px] font-medium uppercase tracking-[0.2em] text-dim">
            Answer
            {meta && (
              <span className="ml-2 font-normal normal-case tracking-normal text-dim/70">
                {meta}
              </span>
            )}
          </h2>
          <div className="pt-5">
            <Answer text={answer} />
          </div>
        </section>
      )}

      {history.length > 0 && (
        <section>
          <h2 className="border-b border-line pb-2 text-[11px] font-medium uppercase tracking-[0.2em] text-dim">
            Recently asked
          </h2>
          <ul className="divide-y divide-line">
            {history.map((q) => (
              <li key={q.id} className="py-3">
                <button
                  className="block w-full text-left"
                  onClick={() => {
                    setQuestion(q.question);
                    setBrand(q.brand_filter ?? "");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  <span className="text-sm hover:underline">{q.question}</span>
                  <span className="mt-0.5 block text-xs text-dim">
                    {q.brand_filter ?? "All brands"} · {shortDate(q.asked_at)}
                    {q.error && " · failed"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
