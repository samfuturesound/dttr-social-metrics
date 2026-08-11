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
