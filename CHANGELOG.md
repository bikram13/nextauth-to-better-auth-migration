# Changelog

All notable changes to this reference repo will be documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [SemVer](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] — 2026-05-02

Initial public release. Verified end-to-end against the stack matrix below.

### Added

- Drizzle schema for both Auth.js v5 legacy tables (`user`, `account`, `session`, `verification_token`) and Better Auth tables (`ba_user`, `ba_account`, `ba_session`, `ba_verification`) plus plugin tables (organization, two-factor, passkey)
- SQL backfill migration (`scripts/migrate-to-better-auth.ts`) covering `id_token` preservation, `emailVerified` timestamp→boolean conversion, `expires_at` bigint→timestamptz conversion, and `stripe_customer_id` carry-through
- bcrypt credentials migration onto `ba_account.password` with `provider_id='credential'`
- 2FA secret Base64→Base32 migration (`scripts/migrate-2fa-secrets.ts`)
- Dual-validation middleware (`middleware.ts`) — Better Auth cookie first, NextAuth legacy fallback
- Reissue-from-legacy route handler (`app/api/auth/reissue-from-legacy/route.ts`) using `internalAdapter.createSession()` with the correct 1.6.x signature and HMAC-signed cookie
- Better Auth config (`lib/auth.ts`) with `magicLink`, `organization`, `twoFactor` plugins for 1.6.x
- Playwright suite — 5 tests covering sign-up, no-session redirect, valid-legacy reissue, expired-legacy redirect, forged-legacy redirect

### Verified against

| Component | Version |
|---|---|
| Better Auth | 1.6.9 |
| Drizzle ORM | 0.45.2 |
| Drizzle Kit | 0.31.10 |
| next-auth (Auth.js v5) | 5.0.0-beta.25 |
| Next.js | 15.5.x |
| Postgres | 16-alpine |
| Node.js | 20+ |
| pnpm | 9 |

### Fixed (corrections discovered during runtime verification)

These are the eight corrections applied to the upstream playbook draft after running every code block end-to-end. Each is documented in the README.

1. Drizzle peer-dep version floor (≥ 0.45 / ≥ 0.31.4 — older versions break adapter plugin paths)
2. `ba_verification` UNIQUE constraint on `(identifier, value)` — without it, re-running the migration creates duplicates
3. Documented why `account.type` is dropped (BA derives type from `provider_id`)
4. Clarified `next-auth` package vs Auth.js naming
5. Added "Tested against Better Auth 1.6.x" version pin
6. `internalAdapter.createSession()` — 1.6.x signature is `(userId, dontRememberMe, override)`, not `(userId, requestObject)`
7. Better Auth session cookie must be HMAC-SHA256 signed; raw token returns null silently from `getSession()`
8. `twoFactorEnabled` boolean column on `ba_user` is required when the `twoFactor()` plugin is registered — sign-up returns 500 without it

[Unreleased]: https://github.com/bikram13/nextauth-to-better-auth-migration/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/bikram13/nextauth-to-better-auth-migration/releases/tag/v1.0.0
