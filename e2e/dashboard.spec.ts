import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const composer = "Ask SS";

test("shows the Google-backed home and account menu", async ({ page }) => {
  await page.goto("/calendar");

  await expect(page.getByRole("heading", { name: "SS", exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Connect Google Calendar" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Open profile menu" }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
});

test("summons the agent instead of siting it on the page", async ({ page }) => {
  await page.goto("/calendar");
  await expect(page.getByRole("heading", { name: "SS", exact: true })).toBeVisible();

  await expect(page.getByLabel(composer)).toBeHidden();

  await page.getByRole("button", { name: /Ask SS/ }).click();
  await expect(page.getByLabel(composer)).toBeVisible();
  await expect(page.getByLabel(composer)).toBeEnabled();

  await page.keyboard.press("Escape");
  await expect(page.getByLabel(composer)).toBeHidden();
});

test("passes Axe on the disconnected dashboard", async ({ page }) => {
  await page.goto("/calendar");
  await expect(page.getByRole("heading", { name: "SS", exact: true })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("passes Axe with the agent open", async ({ page }) => {
  await page.goto("/calendar");
  await page.getByRole("button", { name: /Ask SS/ }).click();
  await expect(page.getByLabel(composer)).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("moves between Calendar and Library", async ({ page }, testInfo) => {
  const itemName = `Battery chemistry ${Date.now()}`;
  const itemLink = `https://example.com/battery-chemistry-${Date.now()}`;
  const theRead =
    "Solid-state cells swap the liquid electrolyte for a ceramic one. ".repeat(4);
  await page.goto("/calendar");

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
  const itemForm = page.getByRole("form", { name: "Create library item" });
  await itemForm.getByLabel("Title").fill(itemName);
  await itemForm.getByLabel("Description").fill("How solid-state cells change the grid.");
  await itemForm.getByLabel("The read (optional)").fill(theRead);
  await itemForm.getByLabel("Link").fill(itemLink);
  await itemForm.getByRole("checkbox", { name: "Article" }).check();
  await itemForm.getByRole("checkbox", { name: "Science" }).check();
  await itemForm.getByRole("button", { name: "Add item" }).click();
  await expect(itemForm.getByText("Item added.")).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("link", { name: new RegExp(itemName) })).toBeVisible();
  await expect(page).toHaveTitle("Library — SS");

  await page
    .getByRole("searchbox", { name: "Search the library" })
    .fill("solid-state grid");
  const scienceFilter = page.getByRole("button", { name: "Science" });
  await scienceFilter.click();
  await expect(scienceFilter).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("link", { name: new RegExp(itemName) })).toBeVisible();

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    ),
  ).toBe(false);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page.getByRole("link", { name: new RegExp(itemName) }).click();
  await expect(page).toHaveURL(/\/library\/[^/]+$/);
  const readingHeading = page.getByRole("heading", { name: itemName });
  const sourceCard = page.getByRole("link", { name: /Read the original/ });
  await expect(readingHeading).toBeVisible();
  await expect(page.getByText(theRead.trim())).toBeVisible();
  /* The card names itself from whatever preview the source page yields, so match its one fixed line. */
  await expect(sourceCard).toHaveAttribute("href", itemLink);

  const headingBox = await readingHeading.boundingBox();
  const cardBox = await sourceCard.boundingBox();
  if (!headingBox || !cardBox) throw new Error("Reading hero was not laid out.");
  if (agentIsModal) {
    expect(cardBox.y).toBeGreaterThan(headingBox.y + headingBox.height);
  } else {
    expect(cardBox.x).toBeGreaterThan(headingBox.x + headingBox.width);
  }

  await expect(page).toHaveTitle(`${itemName} — SS`);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("link", { name: "Library", exact: true }).first().click();
  await expect(page).toHaveURL(/\/library$/);

  await page.getByRole("link", { name: "Calendar" }).click();
  await expect(page).toHaveURL(/\/calendar$/);
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

  await page.goto("/calendar");

  await expect(page.getByRole("heading", { name: "Upcoming events" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Standup/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Holiday/ })).toBeVisible();
});
