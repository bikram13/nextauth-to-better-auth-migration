/**
 * Auth.js v5 (next-auth@beta) config — represents the buyer's pre-migration setup.
 * Used by middleware.ts during the dual-validation window.
 */
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import bcrypt from "bcryptjs";
import { db, sql } from "@/db";

export const {
  auth: legacyAuth,
  handlers: legacyHandlers,
  signIn: legacySignIn,
  signOut: legacySignOut,
} = NextAuth({
  adapter: DrizzleAdapter(db),
  secret: process.env.AUTH_SECRET,
  session: { strategy: "database", maxAge: 60 * 60 * 24 * 30 },
  providers: [
    Google({ clientId: process.env.AUTH_GOOGLE_ID, clientSecret: process.env.AUTH_GOOGLE_SECRET }),
    GitHub({ clientId: process.env.AUTH_GITHUB_ID, clientSecret: process.env.AUTH_GITHUB_SECRET }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "");
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;
        const rows = await sql<{ id: string; passwordHash: string | null; name: string | null; email: string }[]>`
          SELECT id, "passwordHash", name, email FROM "user" WHERE email = ${email} LIMIT 1
        `;
        const user = rows[0];
        if (!user || !user.passwordHash) return null;
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;
        return { id: user.id, name: user.name, email: user.email };
      },
    }),
  ],
});
