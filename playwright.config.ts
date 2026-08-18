import { defineConfig, devices } from "@playwright/test";

import { E2E_ACCOUNTS } from "./e2e/credentials";

// Overridable so parallel workspaces do not reuse each other's dev server.
const port = Number(process.env.PLAYWRIGHT_PORT ?? 3000);
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  timeout: 60_000,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: E2E_ACCOUNTS.chromium.storageState,
      },
      dependencies: ["setup"],
    },
    {
      name: "mobile-chromium",
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 390, height: 844 },
        storageState: E2E_ACCOUNTS["mobile-chromium"].storageState,
      },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: `env -u FORCE_COLOR pnpm dev --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
