import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000, // CI cold-compile + first-run JIT is slow; bumped from 30s
  expect: {
    timeout: 20_000, // Next.js dev mode compiles routes on first hit (3-4s);
                     // toHaveURL default 5s is too tight for the first sign-up POST
  },
  fullyParallel: false, // tests share the DB, run serially
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3100",
    trace: "off",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 20_000,
  },
  webServer: {
    command: "pnpm exec next dev --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    timeout: 60_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      DATABASE_URL: "postgresql://auth_user:auth_pass@localhost:5433/auth_db",
      AUTH_SECRET: "insecure_dev_secret_replace_in_prod_at_least_32_chars",
      BETTER_AUTH_SECRET: "different_insecure_secret_at_least_32_chars_long_for_dev",
      BETTER_AUTH_URL: "http://localhost:3100",
      NEXT_PUBLIC_APP_URL: "http://localhost:3100",
      APP_URL: "http://localhost:3100",
      AUTH_GOOGLE_ID: "mock-google-client-id",
      AUTH_GOOGLE_SECRET: "mock-google-client-secret",
      AUTH_GITHUB_ID: "mock-github-client-id",
      AUTH_GITHUB_SECRET: "mock-github-client-secret",
      GOOGLE_CLIENT_ID: "mock-google-client-id",
      GOOGLE_CLIENT_SECRET: "mock-google-client-secret",
      GITHUB_CLIENT_ID: "mock-github-client-id",
      GITHUB_CLIENT_SECRET: "mock-github-client-secret",
    },
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
