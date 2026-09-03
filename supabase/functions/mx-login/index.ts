// mx-login — shared-password sign-in for the DTTR social metrics page.
//
// Verifies the submitted password against the MX_SHARED_PASSWORD secret and, on
// success, returns a real Supabase session for the internal service account. The
// browser never holds the password check and the anon key alone cannot read any
// mx data.
//
// There is no default password. If MX_SHARED_PASSWORD is unset or blank the
// function fails closed with 503 and accepts nothing. It used to fall back to a
// literal, so a deploy that had never been given the secret behaved exactly like
// a correctly configured one — and the literal was published in the README.
//
// The service account (mx-internal@dttrsocialmetrics.app) is created and
// maintained by this function itself via the admin API. Its password is
// derived from the service-role key, so there is no second secret to manage
// and nothing to rotate by hand — if sign-in fails, the function re-syncs the
// account and retries.
//
// Deployed with verify_jwt=false: callers are unauthenticated by definition;
// the shared password IS the auth check.

import { createClient } from "npm:@supabase/supabase-js@2";
import { checkSharedPassword } from "./auth.ts";

const SERVICE_EMAIL = "mx-internal@dttrsocialmetrics.app";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function servicePassword(): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode("mx-internal-service-account-v1"),
  );
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { password } = await req.json();
    const verdict = checkSharedPassword(
      password,
      Deno.env.get("MX_SHARED_PASSWORD"),
    );
    if (!verdict.ok) {
      if (verdict.status === 503) {
        // Loud, and not the caller's fault. Nothing here reveals a secret:
        // there isn't one.
        console.error("mx-login: MX_SHARED_PASSWORD is not set — refusing all sign-ins");
      } else {
        await new Promise((r) => setTimeout(r, 500));
      }
      return json({ error: verdict.error }, verdict.status);
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      auth: { persistSession: false },
    });
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });
    const secret = await servicePassword();

    let { data, error } = await anon.auth.signInWithPassword({
      email: SERVICE_EMAIL,
      password: secret,
    });

    if (error) {
      // First run, or the service-role key rotated — (re)sync the account.
      const { error: createErr } = await admin.auth.admin.createUser({
        email: SERVICE_EMAIL,
        password: secret,
        email_confirm: true,
      });
      if (createErr) {
        // Already exists with a stale password — find it and reset.
        const { data: list, error: listErr } =
          await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        if (listErr) return json({ error: listErr.message }, 500);
        const user = list.users.find(
          (u) => u.email?.toLowerCase() === SERVICE_EMAIL,
        );
        if (!user) return json({ error: createErr.message }, 500);
        const { error: updErr } = await admin.auth.admin.updateUserById(
          user.id,
          { password: secret },
        );
        if (updErr) return json({ error: updErr.message }, 500);
      }
      ({ data, error } = await anon.auth.signInWithPassword({
        email: SERVICE_EMAIL,
        password: secret,
      }));
      if (error) return json({ error: error.message }, 500);
    }

    const s = data.session!;
    return json({
      access_token: s.access_token,
      refresh_token: s.refresh_token,
      expires_at: s.expires_at,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
