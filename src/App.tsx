import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, MOCK } from "./lib/supabase";
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
  if (!MOCK && !session) return <Login />;
  return <Dashboard />;
}
