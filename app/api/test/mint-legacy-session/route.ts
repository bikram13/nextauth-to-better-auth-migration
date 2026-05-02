/**
 * TEST-ONLY endpoint — mints a legacy NextAuth session for a seeded user id.
 * Used by Playwright tests to simulate "buyer arrives with valid Auth.js cookie."
 *
 * NEVER expose this in production. Production has a NODE_ENV gate; we additionally
 * gate behind a header that only the Playwright suite sends.
 */
import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/db";
import { randomUUID } from "node:crypto";

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "forbidden in production" }, { status: 403 });
  }
  if (req.headers.get("x-playwright-test") !== "1") {
    return NextResponse.json({ error: "test header required" }, { status: 403 });
  }

  const { userId, expiredHoursAgo } = (await req.json()) as {
    userId: string;
    expiredHoursAgo?: number;
  };

  const token = `test_legacy_${randomUUID()}`;
  const expires = expiredHoursAgo
    ? new Date(Date.now() - expiredHoursAgo * 60 * 60 * 1000)
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await sql`
    INSERT INTO session ("sessionToken", "userId", expires)
    VALUES (${token}, ${userId}, ${expires.toISOString()})
  `;

  const res = NextResponse.json({ ok: true, token, expiresAt: expires.toISOString() });
  res.cookies.set("authjs.session-token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
