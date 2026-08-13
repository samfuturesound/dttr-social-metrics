import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, MOCK } from "./lib/supabase";
import {
  brandFromPath,
  labelFromPath,
  labelShareFromPath,
  shareFromPath,
  useRoute,
} from "./lib/router";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import BrandPage from "./components/BrandPage";
import LabelPage from "./components/LabelPage";
import SharePage from "./components/SharePage";
import LabelSharePage from "./components/LabelSharePage";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const path = useRoute();

  // Label shares are matched first: /share/label/x carries a second segment
  // the brand-share pattern deliberately won't match.
  const labelShareToken = labelShareFromPath(path);
  const shareToken = shareFromPath(path);
  const isPublic = Boolean(labelShareToken || shareToken);

  useEffect(() => {
    if (MOCK || isPublic) {
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
  }, [isPublic]);

  // Public routes sit ahead of the auth gate — the share RPCs are granted to
  // anon and scoped to their token, so no session is needed or wanted.
  if (labelShareToken)
    return <LabelSharePage key={labelShareToken} token={labelShareToken} />;
  if (shareToken) return <SharePage key={shareToken} token={shareToken} />;

  if (!ready) return null;
  if (!MOCK && !session) return <Login />;

  const labelSlug = labelFromPath(path);
  if (labelSlug) return <LabelPage key={labelSlug} slug={labelSlug} />;

  const brand = brandFromPath(path);
  if (brand) return <BrandPage key={brand} brand={brand} />;
  return <Dashboard />;
}
