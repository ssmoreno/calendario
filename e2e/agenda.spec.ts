import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const emptyCalendar = {
  version: 1,
  revision: 0,
  updatedAt: "1970-01-01T00:00:00.000Z",
  events: [],
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript((calendar) => {
    if (localStorage.getItem("calendario.e2e.initialized") !== "1") {
      localStorage.setItem("calendario.events.v1", JSON.stringify(calendar));
      localStorage.removeItem("calendario.preferences.v1");
      localStorage.setItem("calendario.e2e.initialized", "1");
    }
  }, emptyCalendar);
});

test("creates and persists an event", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your days are wide open." })).toBeVisible();

  await page.getByRole("button", { name: "Add event" }).first().click();
  const editor = page.getByRole("dialog", { name: "Add event" });
  const defaultDate = await editor.getByLabel("Date").inputValue();
  const pastDate = new Date(`${defaultDate}T12:00:00Z`);
  pastDate.setUTCDate(pastDate.getUTCDate() - 1);
  await editor.getByLabel("Date").fill(pastDate.toISOString().slice(0, 10));
  await page.getByRole("textbox", { name: "Event title" }).fill("Dinner with Jo");
  await page.getByLabel("Location").fill("San Telmo");
  await page.getByRole("button", { name: "Save event" }).click();

  await expect(page.getByText("Dinner with Jo")).toBeVisible();
  const futureDate = new Date(`${defaultDate}T12:00:00Z`);
  futureDate.setUTCDate(futureDate.getUTCDate() + 1);
  await page.getByRole("button", { name: "Add event" }).first().click();
  const futureEditor = page.getByRole("dialog", { name: "Add event" });
  await futureEditor
    .getByLabel("Date")
    .fill(futureDate.toISOString().slice(0, 10));
  await futureEditor.getByLabel("Event title").fill("Tomorrow plan");
  await futureEditor.getByRole("button", { name: "Save event" }).click();

  await expect(page.getByText("Tomorrow plan")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Dinner with Jo")).toBeVisible();
  await expect(page.getByText("Tomorrow plan")).toBeVisible();
  const populatedResults = await new AxeBuilder({ page }).analyze();
  expect(populatedResults.violations).toEqual([]);

  await page.getByRole("button", { name: "Theme: system" }).click();
  await page.getByRole("button", { name: "Theme: light" }).click();
  await expect(
    page.getByRole("heading", { name: "Only what matters" }),
  ).toHaveCSS("color", "rgb(244, 240, 230)");
  const darkPopulatedResults = await new AxeBuilder({ page }).analyze();
  expect(darkPopulatedResults.violations).toEqual([]);
  await page.getByRole("button", { name: /Tomorrow plan/ }).click();
  await expect(page.locator("[data-entering]")).toHaveCount(0);
  const darkEditorResults = await new AxeBuilder({ page }).analyze();
  expect(darkEditorResults.violations).toEqual([]);
});

test("cycles theme and has no automatically detectable accessibility violations", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Theme: system" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme-preference", "light");

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);

  await page.getByRole("button", { name: "Add event" }).first().click();
  await expect(page.locator("[data-entering]")).toHaveCount(0);
  const editorResults = await new AxeBuilder({ page }).analyze();
  expect(editorResults.violations).toEqual([]);

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute(
    "data-theme-preference",
    "light",
  );
  await page.getByRole("button", { name: "Theme: light" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(
    page.getByRole("heading", { name: "Only what matters" }),
  ).toHaveCSS("color", "rgb(244, 240, 230)");
  const darkResults = await new AxeBuilder({ page }).analyze();
  expect(darkResults.violations).toEqual([]);
});

test("restores focus after closing the editor with the keyboard", async ({
  page,
}) => {
  await page.goto("/");
  const addEvent = page.getByRole("button", { name: "Add event" }).first();
  await addEvent.click();
  await expect(page.getByRole("dialog", { name: "Add event" })).toBeVisible();

  await page.keyboard.press("Escape");

  await expect(page.getByRole("dialog", { name: "Add event" })).toHaveCount(0);
  await expect(addEvent).toBeFocused();
});

test("opens creation prefilled from an empty date in the navigator", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open date navigator" }).click();
  const target = page
    .locator(
      '[role="gridcell"] [role="button"]:not([aria-disabled="true"]):not([data-selected="true"])',
    )
    .last();
  const expectedDate = await target.evaluate((element) => {
    const label = element
      .getAttribute("aria-label")
      ?.replace(/^Today, /, "")
      .replace(/ selected$/, "");
    if (!label) throw new Error("Calendar cell has no accessible date label.");
    const parsed = new Date(label);
    return [parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate()]
      .map((part, index) => String(part).padStart(index === 0 ? 4 : 2, "0"))
      .join("-");
  });

  await target.click();

  const editor = page.getByRole("dialog", { name: "Add event" });
  await expect(editor).toBeVisible();
  await expect(editor.getByLabel("Date")).toHaveValue(expectedDate);
});

test("shows and opens occupied dates beyond the agenda window", async ({
  page,
}) => {
  const farDate = new Date();
  farDate.setUTCFullYear(farDate.getUTCFullYear() + 1);
  farDate.setUTCDate(15);
  const dateKey = farDate.toISOString().slice(0, 10);
  const accessibleDate = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(farDate);
  const now = new Date().toISOString();
  const document = {
    version: 1,
    revision: 1,
    updatedAt: now,
    events: [
      {
        id: "far-future-event",
        title: "Far future concert",
        timing: {
          kind: "timed",
          startsAt: `${dateKey}T20:00:00+00:00[UTC]`,
          durationMinutes: 120,
        },
        recurrence: null,
        color: "ultramarine",
        createdAt: now,
        updatedAt: now,
      },
    ],
  };

  await page.goto("/");
  await page.evaluate((calendar) => {
    localStorage.setItem("calendario.events.v1", JSON.stringify(calendar));
  }, document);
  await page.reload();
  await page.getByRole("button", { name: "Open date navigator" }).click();
  for (let month = 0; month < 12; month += 1) {
    await page.getByRole("button", { name: "Next month" }).click();
  }
  const occupiedDate = page.getByRole("button", { name: accessibleDate });
  await expect(occupiedDate.locator("i")).toBeVisible();

  await occupiedDate.click();

  await expect(page.getByText("Far future concert")).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Add event" })).toHaveCount(0);
});

test("expands the agenda into earlier and later ranges", async ({ page }) => {
  const dateAt = (offset: number) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
  };
  const now = new Date().toISOString();
  const event = (id: string, title: string, dateKey: string) => ({
    id,
    title,
    timing: {
      kind: "timed",
      startsAt: `${dateKey}T15:00:00+00:00[UTC]`,
      durationMinutes: 60,
    },
    recurrence: null,
    color: "coral",
    createdAt: now,
    updatedAt: now,
  });
  const document = {
    version: 1,
    revision: 1,
    updatedAt: now,
    events: [
      event("nearby", "Nearby event", dateAt(1)),
      event("older", "Older event", dateAt(-200)),
      event("later", "Later event", dateAt(200)),
    ],
  };

  await page.goto("/");
  await page.evaluate((calendar) => {
    localStorage.setItem("calendario.events.v1", JSON.stringify(calendar));
  }, document);
  await page.reload();
  await expect(page.getByText("Nearby event")).toBeVisible();
  await expect(page.getByText("Older event")).toHaveCount(0);
  await expect(page.getByText("Later event")).toHaveCount(0);

  await page.getByRole("button", { name: /Earlier/ }).click();
  await expect(page.getByText("Older event")).toBeVisible();
  await page.getByRole("button", { name: /Later/ }).click();
  await expect(page.getByText("Later event")).toBeVisible();
});

test("edits one occurrence, following events, and an entire series", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add event" }).first().click();
  await page.getByRole("textbox", { name: "Event title" }).fill("Weekly sync");
  await page.getByRole("button", { name: "Weekly", exact: true }).click();
  await page.getByRole("button", { name: "Save event" }).click();

  await page.getByRole("button", { name: /Weekly sync/ }).first().click();
  await page.getByRole("textbox", { name: "Event title" }).fill("Special sync");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByRole("button", { name: "This occurrence" }).click();
  await expect(page.getByText("Special sync").first()).toBeVisible();

  await page.getByRole("button", { name: /Special sync/ }).first().click();
  await page.getByRole("textbox", { name: "Event title" }).fill("Future sync");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByRole("button", { name: "This and following" }).click();
  await expect(page.getByText("Future sync").first()).toBeVisible();

  await page.getByRole("button", { name: /Future sync/ }).first().click();
  await page.getByRole("textbox", { name: "Event title" }).fill("Full sync");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByRole("button", { name: "Entire series" }).click();
  await expect(page.getByText("Full sync").first()).toBeVisible();
});

test("searches, deletes with undo, and exports local data", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add event" }).first().click();
  await page.getByRole("textbox", { name: "Event title" }).fill("Dentist");
  await page.getByLabel("Location").fill("Recoleta");
  await page.getByRole("button", { name: "Save event" }).click();

  await page.getByRole("button", { name: "Search events" }).click();
  await page.getByRole("searchbox", { name: "Search events" }).fill("Recoleta");
  await expect(page.getByText("Dentist")).toBeVisible();
  await page.getByRole("button", { name: "Close search" }).click();

  await page.getByRole("button", { name: /Dentist/ }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Dentist")).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("Dentist")).toBeVisible();

  await page.getByRole("button", { name: "Calendar data options" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^calendario-\d{4}-\d{2}-\d{2}\.json$/);
});

test("imports a versioned local calendar", async ({ page }) => {
  const eventDate = new Date();
  eventDate.setUTCDate(eventDate.getUTCDate() + 7);
  const dateKey = eventDate.toISOString().slice(0, 10);
  const now = new Date().toISOString();
  const imported = {
    exportedAt: now,
    calendar: {
      version: 1,
      revision: 12,
      updatedAt: now,
      events: [
        {
          id: "imported-reading",
          title: "Imported reading",
          timing: {
            kind: "timed",
            startsAt: `${dateKey}T10:00:00+00:00[UTC]`,
            durationMinutes: 45,
          },
          recurrence: null,
          color: "gold",
          createdAt: now,
          updatedAt: now,
        },
      ],
    },
  };

  await page.goto("/");
  await page.getByRole("button", { name: "Calendar data options" }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "calendario.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(imported)),
  });

  await expect(page.getByRole("status")).toContainText("Calendar imported.");
  await expect(page.getByText("Imported reading")).toBeVisible();
});
