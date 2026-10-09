import { test as base } from "@playwright/test";

export const E2E_USER = {
  email: "e2e@test.local",
  name: "E2E",
  password: "e2e-password-1234",
};

/** A stable private IP derived from the test id. */
function clientIpFor(testId: string) {
  let hash = 0;
  for (const char of testId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
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
