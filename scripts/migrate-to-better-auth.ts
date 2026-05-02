/**
 * Run the SQL migration from Chapter 4 §4.4 of the playbook.
 * Backfills ba_* tables from legacy Auth.js v5 tables.
 *
 * Idempotent: safe to run multiple times. Uses ON CONFLICT DO NOTHING.
 *
 * After this runs, the credentials password migration (§5.4) and 2FA secret migration
 * (§9.1) and stripe_customer_id backfill (§9.6) need to run separately.
 */
import "dotenv/config";
import { sql } from "../db";

async function main() {
  console.log("[migrate] verifying legacy tables exist...");
  const before = await sql<{ users: number; accounts: number; sessions: number; verifications: number }[]>`
    SELECT
      (SELECT COUNT(*)::int FROM "user")               AS users,
      (SELECT COUNT(*)::int FROM "account")            AS accounts,
      (SELECT COUNT(*)::int FROM "session")            AS sessions,
      (SELECT COUNT(*)::int FROM "verification_token") AS verifications
  `;
  console.log("[migrate] legacy counts:", before[0]);

  console.log("[migrate] running Ch 4 §4.4 backfill...");
  await sql.begin(async (tx) => {
    // 1. Backfill ba_user from legacy "user".
    await tx`
      INSERT INTO ba_user (id, name, email, email_verified, image, stripe_customer_id, created_at, updated_at)
      SELECT
        id,
        name,
        email,
        CASE WHEN "emailVerified" IS NOT NULL THEN TRUE ELSE FALSE END,
        image,
        "stripeCustomerId",
        COALESCE("emailVerified", now()),
        now()
      FROM "user"
      ON CONFLICT (email) DO NOTHING
    `;

    // 2. Backfill ba_account from legacy account, mapping snake->camel and bigint->timestamp.
    await tx`
      INSERT INTO ba_account (
        id, user_id, account_id, provider_id,
        access_token, refresh_token, id_token,
        access_token_expires_at, scope, created_at, updated_at
      )
      SELECT
        gen_random_uuid()::text,
        "userId",
        "providerAccountId",
        provider,
        access_token,
        refresh_token,
        id_token,
        CASE WHEN expires_at IS NOT NULL THEN to_timestamp(expires_at) ELSE NULL END,
        scope,
        now(),
        now()
      FROM account
      ON CONFLICT (provider_id, account_id) DO NOTHING
    `;

    // 3. Backfill ba_session — preserve sessionToken into token column.
    await tx`
      INSERT INTO ba_session (id, user_id, token, expires_at, created_at, updated_at)
      SELECT
        gen_random_uuid()::text,
        "userId",
        "sessionToken",
        expires,
        now(),
        now()
      FROM session
      ON CONFLICT (token) DO NOTHING
    `;

    // 4. Backfill ba_verification — token field is renamed to value.
    await tx`
      INSERT INTO ba_verification (id, identifier, value, expires_at, created_at)
      SELECT
        gen_random_uuid()::text,
        identifier,
        token,
        expires,
        now()
      FROM verification_token
      ON CONFLICT DO NOTHING
    `;
  });

  console.log("[migrate] credentials password migration (Ch 5 §5.4)...");
  await sql`
    INSERT INTO ba_account (id, user_id, account_id, provider_id, password, created_at, updated_at)
    SELECT
      gen_random_uuid()::text,
      u.id,
      u.id,
      'credential',
      u."passwordHash",
      now(),
      now()
    FROM "user" u
    WHERE u."passwordHash" IS NOT NULL
    ON CONFLICT (provider_id, account_id) DO NOTHING
  `;

  const after = await sql<{ users: number; accounts: number; sessions: number; verifications: number }[]>`
    SELECT
      (SELECT COUNT(*)::int FROM ba_user)         AS users,
      (SELECT COUNT(*)::int FROM ba_account)      AS accounts,
      (SELECT COUNT(*)::int FROM ba_session)      AS sessions,
      (SELECT COUNT(*)::int FROM ba_verification) AS verifications
  `;
  console.log("[migrate] better-auth counts:", after[0]);

  // Spot-checks
  const spot = await sql<
    { provider_id: string; account_id: string; id_token: string | null; access_token_expires_at: unknown }[]
  >`
    SELECT provider_id, account_id, id_token, access_token_expires_at
    FROM ba_account
    WHERE provider_id IN ('google', 'github', 'apple', 'credential')
    ORDER BY provider_id
  `;
  console.log("[migrate] spot-check accounts:");
  for (const row of spot) {
    const exp = row.access_token_expires_at == null ? "—" : String(row.access_token_expires_at);
    console.log(`  ${row.provider_id} ${row.account_id} idToken=${row.id_token ? "✓" : "—"} expiresAt=${exp}`);
  }

  await sql.end();
  console.log("[migrate] done.");
}

main().catch((e) => {
  console.error("[migrate] failed:", e);
  process.exit(1);
});
