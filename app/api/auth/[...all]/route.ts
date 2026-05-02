/**
 * Better Auth catch-all handler — mounted at /api/auth/* per Better Auth convention.
 * Handles: sign-up/email, sign-in/email, sign-out, get-session, magic-link/*, etc.
 *
 * Note for buyers: Auth.js's old /api/auth/[...nextauth] handler MUST be unmounted
 * before this is added — they share the same path prefix. During the dual-validation
 * window (Ch 6), Auth.js is invoked only via internal helpers, not via its HTTP routes.
 */
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
