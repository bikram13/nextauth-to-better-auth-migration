/**
 * Seed legacy Auth.js v5 data — represents the buyer's pre-migration state.
 * Inserts 5 users with realistic mix:
 *   1. Google OAuth user with verified email
 *   2. GitHub OAuth user
 *   3. Apple OAuth user (id_token preserved)
 *   4. Credentials user with bcrypt password hash
 *   5. Email-only user with pending verification
 */
import "dotenv/config";
import { db, sql } from "../db";
import { legacyUser, legacyAccount, legacySession, legacyVerificationToken } from "../db/schema/auth-legacy";
import bcrypt from "bcryptjs";

const NOW = Math.floor(Date.now() / 1000);
const HOUR = 60 * 60;

async function main() {
  console.log("[seed] truncating legacy tables...");
  await sql`TRUNCATE "session", "account", "verification_token", "user" RESTART IDENTITY CASCADE`;

  console.log("[seed] inserting 5 legacy users...");
  await db.insert(legacyUser).values([
    {
      id: "u_google_alice",
      name: "Alice Google",
      email: "alice@example.test",
      emailVerified: new Date(Date.now() - 30 * 24 * HOUR * 1000),
      image: "https://example.test/alice.png",
      stripeCustomerId: "cus_alice",
    },
    {
      id: "u_github_bob",
      name: "Bob Github",
      email: "bob@example.test",
      emailVerified: new Date(Date.now() - 14 * 24 * HOUR * 1000),
      image: "https://example.test/bob.png",
      stripeCustomerId: "cus_bob",
    },
    {
      id: "u_apple_carol",
      name: "Carol Apple",
      email: "carol@example.test",
      emailVerified: new Date(Date.now() - 7 * 24 * HOUR * 1000),
      image: null,
      stripeCustomerId: null,
    },
    {
      id: "u_creds_dan",
      name: "Dan Credentials",
      email: "dan@example.test",
      emailVerified: new Date(Date.now() - 60 * 24 * HOUR * 1000),
      image: null,
      passwordHash: await bcrypt.hash("DanLegacy!23", 10),
      stripeCustomerId: "cus_dan",
    },
    {
      id: "u_pending_eve",
      name: null,
      email: "eve@example.test",
      emailVerified: null, // pending
      image: null,
      stripeCustomerId: null,
    },
  ]);

  console.log("[seed] inserting accounts...");
  await db.insert(legacyAccount).values([
    {
      userId: "u_google_alice",
      type: "oauth",
      provider: "google",
      providerAccountId: "google_alice_117",
      access_token: "ya29.alice-access",
      refresh_token: "1//refresh-alice",
      expires_at: NOW + HOUR,
      token_type: "Bearer",
      scope: "openid email profile",
      id_token: "eyJ.alice-id.token",
    },
    {
      userId: "u_github_bob",
      type: "oauth",
      provider: "github",
      providerAccountId: "98765",
      access_token: "ghp_bob-access",
      token_type: "Bearer",
      scope: "read:user user:email",
    },
    {
      userId: "u_apple_carol",
      type: "oauth",
      provider: "apple",
      providerAccountId: "001234.carol",
      access_token: "apple_at_carol",
      refresh_token: "apple_rt_carol",
      expires_at: NOW + HOUR,
      token_type: "Bearer",
      scope: "name email",
      id_token: "eyJ.carol-apple-id-token", // CRITICAL — Apple revocation needs this
    },
  ]);

  console.log("[seed] inserting active sessions...");
  await db.insert(legacySession).values([
    {
      sessionToken: "leg_sess_alice_abc123",
      userId: "u_google_alice",
      expires: new Date(Date.now() + 7 * 24 * HOUR * 1000),
    },
    {
      sessionToken: "leg_sess_bob_def456",
      userId: "u_github_bob",
      expires: new Date(Date.now() + 7 * 24 * HOUR * 1000),
    },
    {
      sessionToken: "leg_sess_dan_ghi789",
      userId: "u_creds_dan",
      expires: new Date(Date.now() + 7 * 24 * HOUR * 1000),
    },
  ]);

  console.log("[seed] inserting pending verification token for Eve...");
  await db.insert(legacyVerificationToken).values({
    identifier: "eve@example.test",
    token: "verify_eve_xyz999",
    expires: new Date(Date.now() + 24 * HOUR * 1000),
  });

  const counts = await sql<{ users: number; accounts: number; sessions: number; verifications: number }[]>`
    SELECT
      (SELECT COUNT(*)::int FROM "user")               AS users,
      (SELECT COUNT(*)::int FROM "account")            AS accounts,
      (SELECT COUNT(*)::int FROM "session")            AS sessions,
      (SELECT COUNT(*)::int FROM "verification_token") AS verifications
  `;
  console.log("[seed] done. counts:", counts[0]);
  await sql.end();
}

main().catch((e) => {
  console.error("[seed] failed:", e);
  process.exit(1);
});
