// The shared-password decision, kept free of Deno APIs so it can be tested by
// `bun test` without a Deno runtime. index.ts supplies the environment; this
// file only decides.
//
// There is deliberately no default password here. mx-login previously fell back
// to a literal when MX_SHARED_PASSWORD was unset, which meant a deploy missing
// its secret looked identical to a working one — and the fallback was published
// in this repo's README. A missing secret must fail closed and say so.

export type Verdict =
  | { ok: true }
  /** 401: the caller got it wrong. 503: the deployment is misconfigured. */
  | { ok: false; status: 401 | 503; error: string };

export const NOT_CONFIGURED =
  "Sign-in is not configured on this deployment: MX_SHARED_PASSWORD is not set. " +
  "No password will be accepted until it is.";

export const WRONG_PASSWORD = "Wrong password";

/** Length-independent comparison, so a miss reveals nothing by timing. */
export function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  let diff = ab.length ^ bb.length;
  const len = Math.max(ab.length, bb.length);
  for (let i = 0; i < len; i++) {
    diff |= (ab[i % ab.length] ?? 0) ^ (bb[i % bb.length] ?? 0);
  }
  return diff === 0;
}

/**
 * Decides whether a submitted password may sign in.
 *
 * `secret` is the raw MX_SHARED_PASSWORD value: undefined when the variable is
 * unset, and possibly blank when it is set to nothing useful. Both fail closed
 * — a secret of spaces is a misconfiguration, not a password.
 *
 * The configuration check comes first and does not look at `submitted` at all,
 * so an unconfigured deployment rejects every password identically.
 */
export function checkSharedPassword(
  submitted: unknown,
  secret: string | undefined | null,
): Verdict {
  const expected = typeof secret === "string" ? secret.trim() : "";
  if (expected === "") {
    return { ok: false, status: 503, error: NOT_CONFIGURED };
  }
  if (typeof submitted !== "string") {
    return { ok: false, status: 401, error: WRONG_PASSWORD };
  }
  if (!timingSafeEqual(submitted.trim(), expected)) {
    return { ok: false, status: 401, error: WRONG_PASSWORD };
  }
  return { ok: true };
}
