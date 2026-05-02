/**
 * Reissue endpoint — Chapter 6 §6.2 + §9.5 of the playbook.
 *
 * Verifies the legacy NextAuth session cookie server-side, then creates a Better Auth
 * session via the internal adapter (no email-based guesswork — uses the verified user id
 * from the same request's legacy cookie).
 *
 * Security:
 *  - Same-origin only (referer check)
 *  - Reads legacy cookie directly; never accepts user id from query/body
 *  - Sets BA cookie + clears legacy cookie atomically on the response
 */
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { sql } from "@/db";

// Match better-call's signed-cookie format: `${token}.${base64(HMAC-SHA256)}`.
// Next.js cookies.set() URL-encodes the value automatically on the way out,
// so we return the un-encoded form here (better-call's signCookieValue pre-encodes
// because better-call's own setCookie does not — different cookie API surface).
async function signSessionCookieValue(token: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(token));
  const base64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return `${token}.${base64}`;
}

const LEGACY_COOKIE_NAMES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
];

const REDIRECT_DEFAULT = "/dashboard";

export async function GET(req: NextRequest) {
  // 1. Same-origin check.
  const referer = req.headers.get("referer") ?? "";
  const sameOrigin = !referer || new URL(referer, req.url).origin === new URL(req.url).origin;
  if (!sameOrigin) {
    return NextResponse.json({ error: "cross-origin reissue blocked" }, { status: 403 });
  }

  // 2. Find the legacy cookie.
  let token: string | undefined;
  for (const name of LEGACY_COOKIE_NAMES) {
    const c = req.cookies.get(name);
    if (c?.value) {
      token = c.value;
      break;
    }
  }
  if (!token) {
    return NextResponse.redirect(new URL("/sign-in?error=no_legacy_cookie", req.url));
  }

  // 3. Verify legacy session in the DB. NextAuth's database strategy stores tokens
  //    as the sessionToken column verbatim. We look up by token, check expiry, get userId.
  const rows = await sql<{ user_id: string; expires: Date }[]>`
    SELECT "userId" AS user_id, expires FROM session WHERE "sessionToken" = ${token} LIMIT 1
  `;
  const row = rows[0];
  if (!row) {
    return NextResponse.redirect(new URL("/sign-in?error=invalid_legacy_cookie", req.url));
  }
  if (new Date(row.expires).getTime() < Date.now()) {
    return NextResponse.redirect(new URL("/sign-in?error=expired_legacy_cookie", req.url));
  }

  // 4. Create a Better Auth session via the internal adapter.
  //
  //    NOTE — book correction. Ch 6 §6.2 documented createSession(userId, request) but
  //    Better Auth 1.6.x's actual signature is:
  //      createSession(userId, dontRememberMe?, override?, overrideAll?)
  //    Pass ipAddress/userAgent via the `override` parameter.
  const ctx = await auth.$context;
  const baSession = await ctx.internalAdapter.createSession(
    row.user_id,
    false, // dontRememberMe — false = persistent session
    {
      ipAddress: req.headers.get("x-forwarded-for") ?? "",
      userAgent: req.headers.get("user-agent") ?? "",
    }
  );

  // 5. Build redirect response with BA cookie set + legacy cookie cleared.
  const redirectTo = req.nextUrl.searchParams.get("redirect") ?? REDIRECT_DEFAULT;
  const res = NextResponse.redirect(new URL(redirectTo, req.url));

  // Better Auth's cookie config — matched to Ch 6 §6.3 (30d expiresIn).
  //
  // BOOK CORRECTION — Ch 6 §6.2 missed that Better Auth's session cookie value is
  // SIGNED via HMAC-SHA256 with the BETTER_AUTH_SECRET, then URL-encoded. Setting the
  // raw token won't be recognized by auth.api.getSession() — verification will silently
  // fail and the user lands on /sign-in. Format: encodeURIComponent(`${token}.${sig}`).
  const secret = process.env.BETTER_AUTH_SECRET ?? "insecure_dev_secret_replace_in_prod_at_least_32_chars";
  const signedValue = await signSessionCookieValue(baSession.token, secret);
  res.cookies.set("better-auth.session_token", signedValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: req.url.startsWith("https://"),
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  // Clear all known legacy cookie names.
  for (const name of LEGACY_COOKIE_NAMES) {
    res.cookies.set(name, "", { maxAge: 0, path: "/" });
  }

  return res;
}
