import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const composer = "Ask the calendar agent";

test("shows the Google-backed home and profile navigation", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "SS Calendar" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Connect Google Calendar" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Open profile menu" }).click();
  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Google Calendar" })).toBeVisible();
});

test("summons the agent instead of siting it on the page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "SS Calendar" })).toBeVisible();

  await expect(page.getByLabel(composer)).toBeHidden();

  await page.getByRole("button", { name: /Ask SS/ }).click();
  await expect(page.getByLabel(composer)).toBeVisible();
  // Nothing to ask until Google Calendar is connected.
  await expect(page.getByLabel(composer)).toBeDisabled();

  await page.keyboard.press("Escape");
  await expect(page.getByLabel(composer)).toBeHidden();
});

test("passes Axe on the disconnected dashboard", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "SS Calendar" })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("passes Axe with the agent open", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Ask SS/ }).click();
  await expect(page.getByLabel(composer)).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
