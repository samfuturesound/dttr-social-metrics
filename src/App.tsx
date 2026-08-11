import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, MOCK } from "./lib/supabase";
import { brandFromPath, shareFromPath, useRoute } from "./lib/router";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import BrandPage from "./components/BrandPage";
import SharePage from "./components/SharePage";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const path = useRoute();
  const shareToken = shareFromPath(path);

  useEffect(() => {
    if (MOCK || shareToken) {
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
  }, [shareToken]);

  // Public share route — deliberately ahead of the auth gate. The share RPCs
  // are granted to anon and scoped to the token's brand, so no session is
  // needed or wanted here.
  if (shareToken) return <SharePage key={shareToken} token={shareToken} />;

  if (!ready) return null;
  if (!MOCK && !session) return <Login />;

  const brand = brandFromPath(path);
  if (brand) return <BrandPage key={brand} brand={brand} />;
  return <Dashboard />;
}
