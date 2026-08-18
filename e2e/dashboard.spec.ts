import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("shows the Google-backed home and profile navigation", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "SS Calendar" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Agent" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Upcoming events" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect Google Calendar" })).toBeVisible();
  await expect(page.getByLabel("Ask the calendar agent")).toBeDisabled();

  await page.getByRole("button", { name: "Open profile menu" }).click();
  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Google Calendar" })).toBeVisible();
});

test("passes Axe on the disconnected dashboard", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "SS Calendar" })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
