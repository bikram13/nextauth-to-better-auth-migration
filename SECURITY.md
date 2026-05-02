# Security Policy

## Reporting a vulnerability

If you find a security issue in this repository — for example a migration script that leaks data, a session-handling pattern that bypasses validation, or an example that promotes an insecure default — please **do not open a public issue**.

Email: **31nathbikram@gmail.com**

Include:

- A short description of the issue
- Steps to reproduce (or a minimal repro repo)
- The impact you believe it has
- Your name / handle for credit (optional)

I'll acknowledge within 72 hours and aim to publish a fix or guidance within 14 days. For lower-severity findings, opening a regular issue is fine.

## Scope

This is reference code, not a deployed service. The most relevant security concerns are:

- Patterns that, if copied verbatim into production, would create an auth vulnerability (e.g., the unsigned-cookie pitfall fixed in `app/api/auth/reissue-from-legacy/route.ts`)
- Outdated/vulnerable dependencies (`pnpm audit`)
- The `app/api/test/mint-legacy-session/route.ts` test endpoint — it is gated by `x-playwright-test` and `NODE_ENV !== "production"`; if you adapt this code for production, **delete that route entirely**

## Out of scope

- The mock OAuth secrets in `.env.example` — they are documented placeholders, not real credentials
- The dev-only `BETTER_AUTH_SECRET` and `AUTH_SECRET` in `.env.example` — also documented placeholders

## Credit

Security reporters who want public credit will be listed in the changelog entry for the fix.
