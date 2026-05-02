# Contributing

Thanks for considering a contribution. This repo is a pinned reference for the Auth.js v5 → Better Auth migration; PRs and issues that improve the reference for everyone are welcome.

## Filing issues

If you spot a drift between this code and your installed Better Auth version, **please open an issue and include**:

1. Better Auth version (`pnpm why better-auth` output)
2. Drizzle ORM and Drizzle Kit versions
3. Node version, pnpm version, OS
4. The exact symptom (error message, failing assertion, or unexpected SQL output)
5. The output of `pnpm exec @better-auth/cli generate` if the issue is schema-related — this is the canonical truth for your version

For unclear bugs, attach the failing Playwright trace (`pnpm test:e2e --trace=on`).

## Running the test suite locally

```bash
pnpm install
pnpm db:up                 # Postgres on :5433 via Docker
pnpm exec drizzle-kit push
pnpm db:seed
pnpm db:migrate-better-auth
pnpm test:install          # installs Chromium for Playwright
pnpm exec tsc --noEmit     # typecheck
pnpm test:e2e              # 5/5 should pass
```

If anything fails, that's the bug — open an issue.

## Submitting PRs

1. Fork, branch from `main`, name the branch `fix/<short-description>` or `feat/<short-description>`
2. Keep changes focused — one fix per PR
3. CI must pass (`tsc --noEmit` and the Playwright suite)
4. If you bump a dependency, note the reason in the PR body — pinned versions exist on purpose (see README for the version matrix)
5. Update `CHANGELOG.md` under `## [Unreleased]`

## What we will and won't merge

**Will:** version bumps for Better Auth/Drizzle that we've validated, additional migration edge cases (with tests), schema corrections discovered through real use, README clarifications.

**Won't:** unrelated app features (this is a reference, not a starter), `pnpm` → `npm`/`yarn` swaps (lockfile is intentionally pinned to pnpm), formatting-only PRs.

## Code of conduct

Be civil. Engineering-first discussion. No vendor flame wars.
