import { useState, type FormEvent } from "react";
import { sharedLogin } from "../lib/supabase";
import { Logo } from "./Chrome";

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
    <div className="gate">
      <form onSubmit={submit}>
        <div style={{ marginBottom: 16 }}>
          <Logo size={44} />
        </div>
        <span className="stamp">Future Sound · Dance to the Radio</span>
        <h1>Social Metrics</h1>
        <input
          type="password"
          required
          autoFocus
          autoComplete="one-time-code"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="err">{error}</p>}
        <button type="submit" className="btn solid" disabled={busy}>
          {busy ? "One moment…" : "Enter"}
        </button>
        <p className="foot">
          Internal tool. One shared password, checked server-side. Nothing here
          is public.
        </p>
      </form>
    </div>
  );
}
