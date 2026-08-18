/**
 * One account per Playwright project. Settings now live server-side, so two
 * projects sharing an account would race each other's theme and defaults.
 * Local and CI only.
 */
export const E2E_ACCOUNTS = {
  chromium: {
    email: "e2e-desktop@calendario.invalid",
    name: "Playwright desktop",
    storageState: "e2e/.auth/desktop.json",
  },
  "mobile-chromium": {
    email: "e2e-mobile@calendario.invalid",
    name: "Playwright mobile",
    storageState: "e2e/.auth/mobile.json",
  },
} as const;

export const E2E_PASSWORD = "playwright-calendario-e2e";
