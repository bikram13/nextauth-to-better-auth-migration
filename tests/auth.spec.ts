/**
 * Auth migration runtime verification — Chapter 8 §8.2 of the playbook.
 *
 * Exercises Ch 6 §6.2 dual-validation middleware against a real Next.js server.
 * Mocks OAuth callbacks; uses an internal endpoint to mint legacy sessions.
 */
import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

const BASE = "http://localhost:3100";

// ─── Helpers ───────────────────────────────────────────────────────────

async function mintLegacyCookie(req: APIRequestContext, opts: { userId: string; expiredHoursAgo?: number }) {
  const res = await req.post(`${BASE}/api/test/mint-legacy-session`, {
    headers: { "x-playwright-test": "1", "Content-Type": "application/json" },
    data: opts,
  });
  expect(res.ok(), `mint endpoint returned ${res.status()}`).toBe(true);
  return await res.json();
}

async function getCookies(page: Page) {
  return (await page.context().cookies()).reduce<Record<string, string>>((acc, c) => {
    acc[c.name] = c.value;
    return acc;
  }, {});
}

// ─── Test suite ────────────────────────────────────────────────────────

test.describe("Better Auth — happy path (Ch 5 §5.3 + Ch 8 §8.2)", () => {
  test("sign-up via email creates BA session and lands on dashboard", async ({ page, context }) => {
    const email = `e2e-${Date.now()}@example.test`;
    await page.goto(`${BASE}/sign-up`);
    await page.fill('[data-testid="name"]', "E2E Test");
    await page.fill('[data-testid="email"]', email);
    await page.fill('[data-testid="password"]', "TestPass!23");
    await page.click('[data-testid="submit"]');
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByTestId("signed-in-as")).toContainText(email);
    const cookies = await getCookies(page);
    const baCookieName = Object.keys(cookies).find((n) => n.includes("better-auth.session_token"));
    expect(baCookieName, "BA session cookie should be set").toBeDefined();
  });

  test("dashboard redirects to sign-in when no session", async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await expect(page).toHaveURL(/\/sign-in/);
  });
});

test.describe("Dual-validation window (Ch 6 §6.2 + §6.3)", () => {
  test("user with valid legacy cookie reaches dashboard and is reissued a BA session", async ({
    page,
    context,
    request,
  }) => {
    // 1. Mint legacy session for a seeded user (Alice).
    const minted = await mintLegacyCookie(request, { userId: "u_google_alice" });
    // The mint endpoint sets a cookie on the request context; we copy to the page context.
    await context.addCookies([
      {
        name: "authjs.session-token",
        value: minted.token,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
      },
    ]);

    // 2. Visit a protected page — middleware should detect legacy cookie and redirect to reissue.
    await page.goto(`${BASE}/dashboard`);

    // 3. Wait for the dashboard to actually load (after the reissue redirect chain).
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByTestId("signed-in-as")).toContainText("alice@example.test");

    // 4. Assert: BA cookie set, legacy cookie cleared.
    const cookies = await getCookies(page);
    const baCookie = Object.keys(cookies).find((n) => n.includes("better-auth.session_token"));
    expect(baCookie, "BA session cookie should be set after reissue").toBeDefined();
    expect(cookies["authjs.session-token"], "legacy cookie should be cleared").toBeFalsy();
  });

  test("expired legacy cookie redirects to sign-in", async ({ page, context, request }) => {
    const minted = await mintLegacyCookie(request, {
      userId: "u_google_alice",
      expiredHoursAgo: 1,
    });
    await context.addCookies([
      {
        name: "authjs.session-token",
        value: minted.token,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
      },
    ]);

    await page.goto(`${BASE}/dashboard`);
    await expect(page).toHaveURL(/\/sign-in/);
    await expect(page).toHaveURL(/expired_legacy_cookie/);
  });

  test("invalid (forged) legacy cookie redirects to sign-in", async ({ page, context }) => {
    await context.addCookies([
      {
        name: "authjs.session-token",
        value: "forged_token_does_not_exist",
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
      },
    ]);

    await page.goto(`${BASE}/dashboard`);
    await expect(page).toHaveURL(/\/sign-in/);
    await expect(page).toHaveURL(/invalid_legacy_cookie/);
  });
});
