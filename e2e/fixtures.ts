import { test as base, type Page } from "@playwright/test";

export const E2E_USER = {
  email: "e2e@test.local",
  name: "E2E",
  password: "e2e-password-1234",
};

/** Changes on every run, so a rate-limit window left by a previous run never carries over. */
const runId = `${Date.now()}`;

/** A private IP derived from the test id and the run. */
function clientIpFor(testId: string) {
  let hash = 0;
  for (const char of `${testId}:${runId}`) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `10.${(hash >>> 16) & 255}.${(hash >>> 8) & 255}.${hash & 255}`;
}

/**
 * Each test gets its own client IP (`x-real-ip`, trusted as on Vercel) so the sign-in rate limit hit
 * by one test never blocks another.
 */
export const test = base.extend({
  extraHTTPHeaders: async ({}, use, testInfo) => {
    await use({ "x-real-ip": clientIpFor(testInfo.testId) });
  },
});

export { expect } from "@playwright/test";

export async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(E2E_USER.email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(E2E_USER.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL("/");
}
