import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3000);
const ratesPort = 3999;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    locale: "fr-FR",
    trace: "retain-on-failure",
    // Lets a pre-installed Chromium be used instead of Playwright's download.
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE },
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: [
    {
      // Fixed exchange rates instead of the real API (see e2e/rates-stub.mjs).
      command: `node e2e/rates-stub.mjs`,
      env: { RATES_STUB_PORT: String(ratesPort) },
      url: `http://localhost:${ratesPort}/health`,
      reuseExistingServer: !process.env.CI,
    },
    {
      // Runs against the production build, as deployed.
      command: `pnpm start --port ${port}`,
      env: { EXCHANGE_RATES_URL: `http://localhost:${ratesPort}/v2` },
      url: `http://localhost:${port}/login`,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
