/**
 * Dual-validation middleware — Chapter 6 §6.2 of the playbook.
 *
 * Reads new Better Auth cookie first, falls back to legacy NextAuth cookie.
 * When falling back, reissues a Better Auth session via an internal endpoint
 * (the production-grade pattern from §6.2's "Warning" callout).
 */
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/dashboard", "/settings", "/billing"];
const SIGN_IN = "/sign-in";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!PROTECTED.some((p) => pathname.startsWith(p))) return NextResponse.next();

  // 1. Try Better Auth session first.
  const baCookie = req.cookies.get("better-auth.session_token");
  if (baCookie) return NextResponse.next();

  // 2. Fall back to NextAuth legacy cookie.
  const naCookie =
    req.cookies.get("authjs.session-token") ??
    req.cookies.get("__Secure-authjs.session-token") ??
    req.cookies.get("next-auth.session-token") ??
    req.cookies.get("__Secure-next-auth.session-token");

  if (naCookie) {
    // Production: reissue via internal endpoint that takes the verified user id
    // from the SAME request's legacy cookie (see §6.2 Warning callout + §9.5).
    // For middleware (edge runtime), forward to a node handler that does:
    //    1. verify legacy JWT/session
    //    2. auth.$context.internalAdapter.createSession(userId, { ipAddress, userAgent })
    //    3. setCookie('better-auth.session_token', token); clear legacy cookie
    //
    // Implementation: route through /api/auth/reissue-from-legacy.
    const reissueUrl = new URL("/api/auth/reissue-from-legacy", req.url);
    reissueUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(reissueUrl);
  }

  // 3. No valid session.
  const url = req.nextUrl.clone();
  url.pathname = SIGN_IN;
  url.searchParams.set("callbackUrl", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/dashboard/:path*", "/settings/:path*", "/billing/:path*"],
};
