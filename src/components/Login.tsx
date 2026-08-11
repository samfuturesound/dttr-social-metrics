import { useState, type FormEvent } from "react";
import { sharedLogin } from "../lib/supabase";

export default function Login() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await sharedLogin(password.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <form onSubmit={submit} className="w-full max-w-xs text-center">
        <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-dim">
          Dance to the Radio
        </p>
        <h1 className="mt-1 font-serif text-3xl">Social</h1>
        <input
          type="password"
          required
          autoFocus
          autoComplete="one-time-code"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-10 w-full border-b border-line bg-transparent pb-2 text-center text-lg outline-none placeholder:text-dim/60 focus:border-ink"
        />
        {error && <p className="mt-4 text-sm text-accent">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="mt-8 w-full rounded-full bg-ink py-2.5 text-sm font-medium text-paper hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "One moment…" : "Enter"}
        </button>
      </form>
    </div>
  );
}
