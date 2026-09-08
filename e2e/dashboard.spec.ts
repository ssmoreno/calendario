import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const composer = "Ask the calendar agent";

test("shows the Google-backed home and account menu", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "SS", exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Connect Google Calendar" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Open profile menu" }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
});

test("summons the agent instead of siting it on the page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "SS", exact: true })).toBeVisible();

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
  await expect(page.getByRole("heading", { name: "SS", exact: true })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("passes Axe with the agent open", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Ask SS/ }).click();
  await expect(page.getByLabel(composer)).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("moves between Calendar and Library", async ({ page }, testInfo) => {
  const categoryName = `Reading ${Date.now()}`;
  const itemName = `Battery chemistry ${Date.now()}`;
  await page.goto("/");

  await expect(page.getByRole("link", { name: "Calendar" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.getByRole("button", { name: /Ask SS/ }).click();
  await expect(page.getByLabel(composer)).toBeVisible();

  const agentIsModal = testInfo.project.name === "mobile-chromium";
  if (agentIsModal) {
    await page.keyboard.press("Escape");
    await expect(page.getByLabel(composer)).toBeHidden();
  }

  await page.getByRole("link", { name: "Library" }).click();
  await expect(page).toHaveURL(/\/library$/);
  if (!agentIsModal) await expect(page.getByLabel(composer)).toBeVisible();
  if (!agentIsModal) await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "Library", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Add to library" }).click();
  await page.getByRole("button", { name: "Category" }).click();
  const categoryForm = page.getByRole("form", { name: "Create category" });
  await categoryForm.getByLabel("Name").fill(categoryName);
  await categoryForm.getByRole("button", { name: "Create category" }).click();
  await expect(categoryForm.getByText("Category created.")).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("heading", { name: categoryName })).toBeVisible();

  await page.getByRole("button", { name: "Add to library" }).click();
  const itemForm = page.getByRole("form", { name: "Create library item" });
  await itemForm.getByLabel("Category").selectOption({ label: categoryName });
  await itemForm.getByLabel("Name").fill(itemName);
  await itemForm.getByLabel("Description").fill("How solid-state cells change the grid.");
  await itemForm.getByLabel("Link").fill("https://example.com/battery-chemistry");
  await itemForm.getByRole("button", { name: "Add item" }).click();
  await expect(itemForm.getByText("Item added.")).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("link", { name: new RegExp(itemName) })).toBeVisible();
  await expect(page).toHaveTitle("Library — SS");

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    ),
  ).toBe(false);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page.getByRole("link", { name: "Calendar" }).click();
  await expect(page).toHaveURL(/\/$/);
});

/*
 * The board reads `startsAt` as the plain UTC instant the API sends. Parsing it
 * as a zoned timestamp threw and took the whole page down with it, and every
 * other spec here runs disconnected, so nothing rendered a timed event at all.
 */
test("renders a connected board of timed and all-day events", async ({ page }) => {
  const inTwoHours = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const today = inTwoHours.toISOString().slice(0, 10);
  const tomorrow = new Date(inTwoHours.getTime() + 86_400_000)
    .toISOString()
    .slice(0, 10);

  await page.route("**/api/calendar/upcoming*", (route) =>
    route.fulfill({
      json: {
        status: "connected",
        events: [
          {
            id: "standup",
            title: "Standup",
            timing: {
              kind: "timed",
              startsAt: inTwoHours.toISOString(),
              endsAt: new Date(inTwoHours.getTime() + 1_800_000).toISOString(),
              timeZone: "UTC",
            },
            color: "ultramarine",
            reminderMinutes: [],
            usesDefaultReminder: false,
          },
          {
            id: "holiday",
            title: "Holiday",
            timing: {
              kind: "all-day",
              startDate: today,
              endDateExclusive: tomorrow,
            },
            color: "gold",
            reminderMinutes: [],
            usesDefaultReminder: false,
          },
        ],
      },
    }),
  );

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Upcoming events" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Standup/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Holiday/ })).toBeVisible();
});
