import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const MOCK = import.meta.env.VITE_MOCK === "1";

/**
 * Shared-password sign-in: the mx-login edge function checks the password
 * against its secret and returns a session for the internal service account.
 * The session persists in localStorage like any other Supabase session.
 */
export async function sharedLogin(password: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/mx-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Sign-in failed");
  const { error } = await supabase.auth.setSession({
    access_token: body.access_token,
    refresh_token: body.refresh_token,
  });
  if (error) throw new Error(error.message);
}
