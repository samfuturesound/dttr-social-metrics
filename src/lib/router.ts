import { useEffect, useState } from "react";

/**
 * Minimal path router — two routes ("/" and "/brand/:name") don't justify a
 * dependency. vercel.json's SPA rewrite (and Vite's dev fallback) serve
 * index.html for every path, so real URLs work on refresh and deep-link.
 */
export function navigate(path: string): void {
  history.pushState(null, "", path);
  dispatchEvent(new PopStateEvent("popstate"));
}

export function useRoute(): string {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => {
    const onPop = () => setPath(location.pathname);
    addEventListener("popstate", onPop);
    return () => removeEventListener("popstate", onPop);
  }, []);
  return path;
}

export function brandPath(name: string): string {
  return `/brand/${encodeURIComponent(name)}`;
}

/** Returns the decoded brand name when the path is a brand page, else null. */
export function brandFromPath(path: string): string | null {
  const m = path.match(/^\/brand\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

/** Returns the token when the path is a public share page, else null. */
export function shareFromPath(path: string): string | null {
  const m = path.match(/^\/share\/([A-Za-z0-9_-]+)$/);
  return m ? m[1] : null;
}

export function labelPath(slug: string): string {
  return `/label/${encodeURIComponent(slug)}`;
}

/** Returns the slug when the path is an internal label page, else null. */
export function labelFromPath(path: string): string | null {
  const m = path.match(/^\/label\/([^/]+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

/** Returns the token for a public LABEL share page, else null.
 *  Checked before shareFromPath — /share/label/x has a second segment that
 *  the brand-share pattern deliberately won't match. */
export function labelShareFromPath(path: string): string | null {
  const m = path.match(/^\/share\/label\/([A-Za-z0-9_-]+)$/);
  return m ? m[1] : null;
}
