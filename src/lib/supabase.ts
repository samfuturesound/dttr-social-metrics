import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);

export const MOCK = import.meta.env.VITE_MOCK === "1";

const allowed = (import.meta.env.VITE_ALLOWED_EMAILS ?? "")
  .split(",")
  .map((e: string) => e.trim().toLowerCase())
  .filter(Boolean);

export function isAllowedEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return allowed.includes(email.toLowerCase());
}
