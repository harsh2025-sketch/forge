/**
 * JWT Scanner Playwright configuration (V3 §20.2 Day 13 — E2E critical path).
 *
 * The E2E suite drives the real Next.js application in deterministic test
 * mode: AUTH_MODE=test / BILLING_MODE=test / DATA_MODE=memory use the
 * product's port seams (src/dev-mode/* and src/features/scans/memory-
 * persistence.ts), so the critical path (signup → scan → view findings →
 * export) runs without live Clerk/Stripe credentials or a database.
 *
 * Live external verification (real Clerk signup / Stripe checkout) is not
 * part of this suite — see docs/TESTING.md for the distinction.
 */

import { defineConfig, devices } from "@playwright/test";

const PORT = 3200;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    // CI/local runs may point Playwright at a pre-installed browser binary
    // (e.g. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/path/to/chromium`) instead
    // of downloading the Playwright browser bundle.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : undefined,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `AUTH_MODE=test BILLING_MODE=test DATA_MODE=memory ./node_modules/.bin/next dev -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
