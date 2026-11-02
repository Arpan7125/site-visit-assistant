import { defineConfig, devices } from "@playwright/test";

/** Runs against a seeded local database (`pnpm db:seed -- --reset` first). */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  retries: 0,
  workers: 1,
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure" },
  projects: [{ name: "mobile", use: { ...devices["Pixel 7"], viewport: { width: 375, height: 812 } } }],
  webServer: { command: "pnpm dev", url: "http://localhost:3000", reuseExistingServer: true, timeout: 120_000 },
});
