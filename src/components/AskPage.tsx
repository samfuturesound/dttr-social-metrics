import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { askAI, fetchAiQueries, fetchBrands } from "../lib/data";
import { shortDate } from "../lib/format";
import { AppBar, TopStripe } from "./Chrome";
import type { AiQuery, Brand } from "../lib/types";

const PERIODS = [
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 365, label: "12 months" },
];

/** A guidance block above the question box. */
function Guide({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card" style={{ marginBottom: 0 }}>
      <div className="eyebrow">
        <span>{title}</span>
      </div>
      <div className="note" style={{ marginTop: 0 }}>
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
    <div style={{ maxWidth: "70ch", fontSize: 14, lineHeight: 1.6 }}>
      {blocks.map((block, i) => {
        const lines = block.split("\n").filter((l) => l.trim());
        const isList = lines.every((l) => /^\s*[-*·•]\s+/.test(l));
        if (isList) {
          return (
            <ul key={i} style={{ paddingLeft: 18, margin: "0 0 10px" }}>
              {lines.map((l, j) => (
                <li key={j} style={{ marginBottom: 4 }}>
                  {strip(l.replace(/^\s*[-*·•]\s+/, ""))}
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} style={{ margin: "0 0 10px" }}>
            {strip(block.replace(/\n/g, " "))}
          </p>
        );
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
    <>
      <TopStripe />
      <AppBar current="ask" />

      <div className="wrap">
        <div className="pagehead">
          <h1>AI Summarise</h1>
          <p className="sub">
            Ask a question about the accounts and get an answer drawn from the
            Metricool data behind these pages.
          </p>
        </div>

        <div className="grid g3" style={{ marginBottom: 14 }}>
          <Guide title="What to ask">
            <p style={{ marginTop: 0 }}>
              It can see every post we&rsquo;ve pulled from Metricool — views,
              likes, comments, shares, saves, watch time, skip rate and captions
              — plus each account&rsquo;s medians. Good questions compare things:
            </p>
            <ul style={{ paddingLeft: 18, margin: 0 }}>
              <li>
                How has Tommy Ashby&rsquo;s TikTok performed since the album
                campaign started?
              </li>
              <li>
                Which of L&rsquo;objectif&rsquo;s reels held attention best, and
                what did they have in common?
              </li>
              <li>Compare Far Caspian&rsquo;s engagement on Instagram against TikTok.</li>
              <li>What changed for Twin Atlantic in the last month?</li>
            </ul>
          </Guide>

          <Guide title="How to ask it">
            <p style={{ marginTop: 0 }}>
              Pick one account and one question. The whole roster at once gives
              vaguer answers than a single brand — twelve months of one account
              is a comparison; twelve months of ten accounts is a pile.
            </p>
            <p>
              Name the platform if you care about it. Instagram and TikTok behave
              so differently that a blended answer is usually misleading.
            </p>
            <p style={{ marginBottom: 0 }}>
              Ask it to show its numbers. It&rsquo;ll quote figures you can check
              against the tables, and it&rsquo;s better at spotting patterns than
              at arithmetic.
            </p>
          </Guide>

          <Guide title="What it can't do yet">
            <p style={{ marginTop: 0 }}>
              It only sees Metricool. It knows nothing about streams, ad spend,
              release dates or what was happening that week — so it can tell you
              a post did well, not why the world responded.
            </p>
            <p>
              Caption and hashtag patterns are not there yet. We tested it:
              across 531 posts, no hashtag used eight or more times predicts
              performance, and caption length and question-vs-statement come out
              completely flat. That&rsquo;s not the AI failing — the posts
              weren&rsquo;t written as experiments, so there&rsquo;s nothing to
              find. This becomes useful once the theme accounts have been
              deliberately testing formats for a few months.
            </p>
            <p>
              Newer accounts have thin data. An account needs ten posts on a
              platform before anything is scored, and the theme accounts have
              barely started.
            </p>
            <p>
              Most of our history was backfilled in one go, so we have each
              post&rsquo;s final figures but not how it grew day by day.
              Questions about how quickly something took off can&rsquo;t be
              answered yet — that only accumulates from August 2026 onwards.
            </p>
            <p style={{ marginBottom: 0 }}>
              And it can misread a number even when the data is right. Treat it
              as a place to start looking, not a source of truth.
            </p>
          </Guide>
        </div>

        <form onSubmit={submit} className="card">
          <div className="eyebrow">
            <span>Your question</span>
          </div>

          <div className="grid g2" style={{ marginBottom: 12 }}>
            <label className="f">
              <span>Account</span>
              <select
                className="f"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
              >
                <option value="">All brands</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="f">
              <span>Period</span>
              <select
                className="f"
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
              >
                {PERIODS.map((p) => (
                  <option key={p.days} value={p.days}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="f">
            <span>Question</span>
            <textarea
              className="f"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit(e);
              }}
              rows={3}
              placeholder="Ask a question about these accounts…"
            />
          </label>

          <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <button type="submit" className="btn solid" disabled={busy || !question.trim()}>
              {busy ? "Reading the data…" : "Ask"}
            </button>
            {busy && (
              <span className="note" style={{ marginTop: 0 }}>
                This takes a few seconds — a year of the whole roster is a lot to
                read.
              </span>
            )}
          </div>
        </form>

        {error && (
          <div className="ratewarn">
            <h4>Could not answer</h4>
            <p>{error}</p>
          </div>
        )}

        {answer && (
          <div className="card">
            <div className="eyebrow">
              <span>Answer</span>
              {meta && <span style={{ fontWeight: 500 }}>{meta}</span>}
            </div>
            <Answer text={answer} />
          </div>
        )}

        {history.length > 0 && (
          <div className="card">
            <div className="eyebrow">
              <span>Recently asked</span>
            </div>
            <div className="scroll">
              <table className="t">
                <thead>
                  <tr>
                    <th>Question</th>
                    <th>Account</th>
                    <th>Asked</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((q) => (
                    <tr key={q.id}>
                      <td>
                        <button
                          className="lnk"
                          style={{ textTransform: "none", letterSpacing: 0, fontWeight: 500 }}
                          onClick={() => {
                            setQuestion(q.question);
                            setBrand(q.brand_filter ?? "");
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                        >
                          {q.question}
                        </button>
                        {q.error && <span className="tag">failed</span>}
                      </td>
                      <td>{q.brand_filter ?? "All brands"}</td>
                      <td>{shortDate(q.asked_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
