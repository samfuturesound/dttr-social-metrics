import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, isAllowedEmail, MOCK } from "./lib/supabase";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (MOCK) {
      setReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) =>
      setSession(s),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!ready) return null;

  if (MOCK) return <Dashboard email="mock@local" />;

  if (!session) return <Login />;

  const email = session.user.email;
  if (!isAllowedEmail(email)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-lg">This page is restricted.</p>
        <p className="text-dim text-sm">
          {email} is signed in but not on the access list.
        </p>
        <button
          className="rounded border border-edge px-4 py-2 text-sm hover:bg-panel"
          onClick={() => supabase.auth.signOut()}
        >
          Sign out
        </button>
      </div>
    );
  }

  return <Dashboard email={email!} />;
}
