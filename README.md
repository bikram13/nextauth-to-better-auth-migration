# Auth.js v5 → Better Auth · Migration Reference

A working, end-to-end reference for migrating a Next.js + Drizzle + Postgres app from **Auth.js v5 (next-auth)** to **Better Auth**. Verified against Better Auth `1.6.9` with 5 seeded users and a 5/5-passing Playwright suite.

> **Why this exists.** The Better Auth docs cover the framework. The Auth.js docs cover Auth.js. Nobody documents the migration *between* them — the schema diff, the ID-format gotchas, the dual-cookie window, the silent-fail traps. This repo is the gap-filler. Every block runs.

[![CI](https://github.com/bikram13/nextauth-to-better-auth-migration/actions/workflows/ci.yml/badge.svg)](https://github.com/bikram13/nextauth-to-better-auth-migration/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

---

## What you get

A Next.js 15 app on Postgres 16 + Drizzle 0.45 with both schemas side-by-side. Run the migration scripts and watch the data move from `user`/`account`/`session`/`verification_token` (Auth.js) into `ba_user`/`ba_account`/`ba_session`/`ba_verification` (Better Auth) — with `id_token` preserved, `emailVerified` correctly converted from timestamp to boolean, bcrypt password hashes carried into `ba_account.password`, and 2FA secrets re-encoded from Base64 to Base32.

Concretely:

- **Drizzle schema for both stacks** (`db/schema/auth-legacy.ts` + `db/schema/auth.ts`) — push both with one command
- **Seed script** (`scripts/seed-legacy.ts`) that inserts 5 realistic legacy users: 3 OAuth (Google/GitHub/Apple), 1 credentials with bcrypt hash, 1 with pending email verification
- **The migration** (`scripts/migrate-to-better-auth.ts`) — idempotent SQL, runs the four core backfills + the credentials password copy, prints before/after counts
- **2FA secret migration** (`scripts/migrate-2fa-secrets.ts`) — Base64 → Base32 with detection logic for already-Base32 input
- **Dual-validation middleware** (`middleware.ts`) — read Better Auth cookie first, fall back to legacy NextAuth cookie, redirect to a reissue endpoint
- **Reissue endpoint** (`app/api/auth/reissue-from-legacy/route.ts`) — verifies the legacy session, mints a Better Auth session via `internalAdapter.createSession()`, sets the **HMAC-signed** session cookie (the silent-fail trap most migrations hit)
- **Better Auth config** (`lib/auth.ts`) with `magicLink`, `organization`, `twoFactor` plugins for 1.6.x
- **Playwright suite** (`tests/auth.spec.ts`) — 5 tests: sign-up creates BA session, no-session redirects, valid-legacy reissues, expired-legacy redirects, forged-legacy redirects

## File tree

```
.
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── [...all]/route.ts           # Better Auth handler
│   │   │   └── reissue-from-legacy/        # the dual-cookie reissue (Ch 6)
│   │   └── test/mint-legacy-session/       # test-only, gated to NODE_ENV != production
│   ├── dashboard/page.tsx                  # protected page used by the test suite
│   ├── sign-in/page.tsx
│   ├── sign-up/page.tsx
│   ├── layout.tsx
│   └── page.tsx
├── db/
│   ├── index.ts
│   └── schema/
│       ├── auth-legacy.ts                  # Auth.js v5 tables
│       └── auth.ts                         # Better Auth tables + plugin tables
├── lib/
│   ├── auth.ts                             # Better Auth config (plugins, providers)
│   ├── auth-client.ts                      # client-side helpers
│   └── auth-legacy.ts                      # Auth.js v5 config (kept for the dual-window)
├── scripts/
│   ├── seed-legacy.ts                      # 5 users representing pre-migration state
│   ├── migrate-to-better-auth.ts           # SQL backfill: 4 tables + credentials password
│   └── migrate-2fa-secrets.ts              # Base64 → Base32 for TOTP secrets
├── tests/
│   └── auth.spec.ts                        # 5 Playwright tests
├── middleware.ts                           # dual-validation entry point
├── docker-compose.yml                      # Postgres 16
├── drizzle.config.ts
├── playwright.config.ts
└── package.json
```

## 5-minute quickstart

Requires Docker (OrbStack on macOS works), pnpm 9, Node 20+.

```bash
git clone https://github.com/bikram13/nextauth-to-better-auth-migration.git
cd nextauth-to-better-auth-migration
cp .env.example .env

pnpm install
pnpm db:up                          # Postgres on :5433 via docker compose

pnpm exec drizzle-kit push          # apply both schemas (legacy + Better Auth)
pnpm db:seed                        # 5 legacy users + 3 sessions + 1 pending verification
pnpm db:migrate-better-auth         # the migration — idempotent, run twice if you want

pnpm exec tsx scripts/migrate-2fa-secrets.ts   # 2FA Base64 → Base32

pnpm exec tsc --noEmit              # 0 errors
pnpm test:install                   # one-time: install Playwright Chromium
pnpm test:e2e                       # 5/5 tests pass
```

Expected output: `ba_user`, `ba_account`, `ba_session`, `ba_verification` populated; `id_token` preserved on Apple/Google rows; bcrypt hash carried into `ba_account.password` for the credential row; Playwright reports 5 passed.

## The 8 corrections you'd hit if you wrote this from scratch

These are the eight problems that surfaced when every code block in the playbook was actually executed against Better Auth `1.6.9`. They aren't in the Better Auth changelog because they aren't bugs in Better Auth — they're integration traps that only show up when you migrate.

### 1. Drizzle peer-dep version floor

Better Auth's first-party Drizzle adapter requires `drizzle-orm` ≥ `0.45.2` and `drizzle-kit` ≥ `0.31.4`. Older versions install fine and even compile, but the adapter has plugin-path failures that don't surface until runtime. Pin both at the floor or above. See [`package.json`](./package.json).

### 2. `ba_verification` duplicates on re-run

The straightforward backfill `INSERT INTO ba_verification ... ON CONFLICT DO NOTHING` looks correct, but `ba_verification.id` is a fresh `gen_random_uuid()` on every run, so the conflict target never fires. Re-running the migration creates one duplicate row per pending verification. The fix is a `UNIQUE(identifier, value)` constraint plus an explicit conflict target — see [`db/schema/auth.ts`](./db/schema/auth.ts) and the fourth `INSERT` block in [`scripts/migrate-to-better-auth.ts`](./scripts/migrate-to-better-auth.ts).

### 3. `account.type` looks like data loss but isn't

The Auth.js `account.type` column (e.g. `"oauth"`) doesn't exist in the Better Auth schema. It's not migrated and it's not lost — Better Auth derives the provider type from `provider_id` itself (`"google"` ⇒ OAuth, `"credential"` ⇒ password). The legacy column is dropped on purpose. No data loss to worry about.

### 4. `next-auth` package vs `@auth/core` naming

Auth.js v5's npm package is still `next-auth` (`5.0.0-beta.x`). Grepping your codebase for `@auth/core` returns nothing, even though every doc page calls it Auth.js. The two names refer to the same library; you do not need to swap your dependency. See [`package.json`](./package.json).

### 5. Better Auth versions drift through minor versions

The plugin import surface (`magicLink`, `organization`, `twoFactor` from `better-auth/plugins`) is correct for 1.6.x. Future minors may rename or split. Always verify against your installed version with `pnpm exec @better-auth/cli generate` and diff against [`db/schema/auth.ts`](./db/schema/auth.ts).

### 6. `internalAdapter.createSession()` signature is not what the docs imply

Calling `auth.$context.internalAdapter.createSession(userId, { ipAddress, userAgent })` is a TypeScript error in 1.6.x — the second argument is `dontRememberMe?: boolean`, not a request descriptor. The override object goes third. See [`app/api/auth/reissue-from-legacy/route.ts`](./app/api/auth/reissue-from-legacy/route.ts).

### 7. Better Auth session cookies must be HMAC-signed (silent fail otherwise)

This is the worst one. You mint a session, set `better-auth.session_token` to the raw token, redirect to `/dashboard`. Middleware reads the cookie, calls `auth.api.getSession()`, gets back `null` with no error logged, redirects you to `/sign-in`. Hours of debugging. The cookie value must be `${token}.${base64(HMAC-SHA256(token, BETTER_AUTH_SECRET))}` and **must not be pre-encoded** when set via `NextResponse.cookies.set()` — Next encodes once. See the `signSessionCookieValue` helper in [`app/api/auth/reissue-from-legacy/route.ts`](./app/api/auth/reissue-from-legacy/route.ts).

### 8. The `twoFactor()` plugin requires a `twoFactorEnabled` column on `ba_user`

If you register `twoFactor()` in your config but your schema doesn't have `twoFactorEnabled boolean` on the user table, sign-up returns 500 with `The field "twoFactorEnabled" does not exist in the "user" Drizzle schema.` It's a loud failure (good) but no compile-time signal (bad). See [`db/schema/auth.ts`](./db/schema/auth.ts).

## Prerequisites

- **Node** 20 or later
- **pnpm** 9 (the lockfile is intentionally pinned to pnpm; npm/yarn aren't supported)
- **Docker** for the Postgres 16 container (OrbStack, Docker Desktop, or Linux native all fine)
- **Playwright** Chromium — installed via `pnpm test:install` on first run
- A working understanding of Auth.js v5 — this repo is for people **migrating off** it, not learning auth from zero

## Disclaimer

This is verified against the matrix in [`CHANGELOG.md`](./CHANGELOG.md):

| Component | Version |
|---|---|
| Better Auth | 1.6.9 |
| Drizzle ORM | 0.45.2 |
| Drizzle Kit | 0.31.10 |
| next-auth | 5.0.0-beta.25 |
| Next.js | 15.5.x |
| Postgres | 16-alpine |

If you're on a different Better Auth version, regenerate the canonical schema for your install:

```bash
pnpm exec @better-auth/cli generate
```

Diff the output against [`db/schema/auth.ts`](./db/schema/auth.ts). Trust the generator over this repo for schema; the corrections above are about migration logic, which is mostly version-stable.

## Limits — what's not in this repo

- **Live OAuth** — `.env.example` ships with mock Google/GitHub/Apple credentials. Real OAuth requires you to register apps with each provider
- **Email delivery** — the magic link callback in `lib/auth.ts` logs to console; production needs Resend/SendGrid/SES wiring
- **Cross-subdomain cookie config** — single-host (`localhost`) is exercised; multi-subdomain (`.example.com`) is documented but not test-covered
- **Edge runtime DB driver compatibility** — middleware runs on edge, but the reissue endpoint forces Node runtime
- **Production-grade rollback strategy** — there's no down-migration here

## Want the full playbook?

If you want a 67-page deep dive that covers what this repo doesn't — **rollback strategy, the organization plugin migration in production with existing membership data, edge cases around 2FA secret encoding (Base32 padding, codebases that store backup codes inline)**, and decision trees for hybrid windows longer than 30 days — there's a paid playbook: [Auth.js to Better Auth Migration Playbook · $39 on Gumroad](https://bikram.gumroad.com/l/auth-js-to-better-auth-migration-playbook).

The repo is the verified reference. The book is the narrative around it. You don't need both — most teams will be fine with just the repo. The book exists for people who'd rather read a chapter than reverse-engineer a script.

## Contributing

PRs welcome. If you spot drift between this code and your installed Better Auth version, please open an issue with the version, your Drizzle versions, and the symptom — see [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the template.

## License

MIT — see [`LICENSE`](./LICENSE). Use the code in production. Attribution is appreciated but not required.
