/**
 * Better Auth config — Chapter 5 §5.3 + Ch 6 §6.3 + Ch 7 §7.5 of the playbook.
 */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink, organization, twoFactor } from "better-auth/plugins";
import { db } from "@/db";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // dev-friendly; production should be true
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "mock-google-client-id",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "mock-google-client-secret",
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID ?? "mock-github-client-id",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "mock-github-client-secret",
    },
  },

  // Ch 6 §6.3 — match Auth.js's 30-day session lifetime to avoid surprise logouts
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },

  // Ch 9 §9.3 — explicit account linking config (do not rely on defaults)
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google", "github", "apple"],
    },
  },

  trustedOrigins: [process.env.APP_URL ?? "http://localhost:3100"],

  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        // Production: wire to your email service. Dev: just log.
        console.log(`[magic-link] ${email} → ${url}`);
      },
    }),
    organization(),
    twoFactor(),
  ],

  secret: process.env.BETTER_AUTH_SECRET ?? "insecure_dev_secret_replace_in_prod_at_least_32_chars",
});

export type Session = typeof auth.$Infer.Session;
