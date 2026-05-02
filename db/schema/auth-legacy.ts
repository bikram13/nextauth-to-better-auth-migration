/**
 * Auth.js v5 (next-auth@beta) schema — the "starting state".
 * This is what the buyer's pre-migration codebase looks like.
 *
 * Mirrors the canonical @auth/drizzle-adapter pg schema.
 */
import { pgTable, text, timestamp, integer, primaryKey } from "drizzle-orm/pg-core";

export const legacyUser = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("emailVerified", { withTimezone: true, mode: "date" }),
  image: text("image"),
  passwordHash: text("passwordHash"),
  stripeCustomerId: text("stripeCustomerId").unique(),
});

export const legacyAccount = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => legacyUser.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.provider, t.providerAccountId] }),
  })
);

export const legacySession = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => legacyUser.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true, mode: "date" }).notNull(),
});

export const legacyVerificationToken = pgTable(
  "verification_token",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true, mode: "date" }).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.identifier, t.token] }),
  })
);
