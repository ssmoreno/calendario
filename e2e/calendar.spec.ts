import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

const emptyCalendar = {
  version: 1,
  revision: 0,
  updatedAt: "1970-01-01T00:00:00.000Z",
  events: [],
};

const browserProblems = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const problems: string[] = [];
  browserProblems.set(page, problems);
  page.on("console", (message) => {
    if (message.type() === "warning" || message.type() === "error") {
      problems.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  await page.addInitScript((calendar) => {
    if (localStorage.getItem("calendario.e2e.initialized") !== "1") {
      localStorage.setItem("calendario.events.v1", JSON.stringify(calendar));
      localStorage.removeItem("calendario.preferences.v1");
      localStorage.setItem("calendario.e2e.initialized", "1");
    }
  }, emptyCalendar);
});

test.afterEach(async ({ page }) => {
  expect(browserProblems.get(page) ?? []).toEqual([]);
});

async function todayKey(page: Page) {
  return page.evaluate(() => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const parts = new Intl.DateTimeFormat("en-GB", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone,
    }).formatToParts(new Date());
    const value = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((part) => part.type === type)?.value;
    return `${value("year")}-${value("month")}-${value("day")}`;
  });
}

/** Contrast is only meaningful once entrances and crossfades have landed. */
async function settleAnimations(page: Page) {
  await page.evaluate(async () => {
    const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    // Two frames so pending style changes have produced their animations.
    await nextFrame();
    await nextFrame();
    await Promise.all(
      document
        .getAnimations()
        .filter(
          (animation) =>
            animation.effect?.getComputedTiming().iterations !== Infinity,
        )
        .map((animation) => animation.finished.catch(() => undefined)),
    );
  });
}

function addDays(dateKey: string, amount: number) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

async function replaceCalendar(
  page: Page,
  events: Record<string, unknown>[],
) {
  const now = new Date().toISOString();
  await page.evaluate(
    ({ timestamp, nextEvents }) => {
      localStorage.setItem(
        "calendario.events.v1",
        JSON.stringify({
          version: 1,
          revision: 1,
          updatedAt: timestamp,
          events: nextEvents,
        }),
      );
    },
    { timestamp: now, nextEvents: events },
  );
  await page.reload();
}

function allDayEvent(id: string, title: string, dateKey: string) {
  const now = new Date().toISOString();
  return {
    id,
    title,
    timing: {
      kind: "all-day",
      startDate: dateKey,
      endDateExclusive: addDays(dateKey, 1),
    },
    recurrence: null,
    color: "ultramarine",
    createdAt: now,
    updatedAt: now,
  };
}

test("defaults to Week and creates a 30-minute-snapped event", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("button", { name: "Week" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "Month" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(page.getByLabel("Week view")).toBeVisible();

  const slot = page.getByRole("button", { name: /at 09:00$/ }).first();
  await slot.click({ position: { x: 8, y: 45 } });
  const editor = page.getByRole("dialog", { name: "Add event" });
  await expect(editor.getByLabel("Starts")).toHaveValue("09:30");
  await expect(editor.getByLabel("Ends")).toHaveValue("10:30");
  await editor.getByLabel("Event title").fill("Planning block");
  await editor.getByRole("button", { name: "Save event" }).click();

  await expect(page.getByRole("button", { name: /Planning block/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: /Planning block/ })).toBeVisible();
});

test("switches and navigates Week and Month views", async ({ page }) => {
  await page.goto("/");
  const period = page.getByRole("heading", { level: 1 });
  const originalWeek = await period.textContent();

  await page.getByRole("button", { name: "Next period" }).click();
  await expect(period).not.toHaveText(originalWeek ?? "");
  await page.getByRole("button", { name: "Today" }).click();
  await expect(period).toHaveText(originalWeek ?? "");

  await page.getByRole("button", { name: "Month" }).click();
  await expect(page.getByLabel("Month view")).toBeVisible();
  await expect(page.getByRole("button", { name: "Month" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const originalMonth = await period.textContent();
  await page.getByRole("button", { name: "Next period" }).click();
  await expect(period).not.toHaveText(originalMonth ?? "");
  await page.getByRole("button", { name: "Previous period" }).click();
  await expect(period).toHaveText(originalMonth ?? "");
});

test("creates Month events at 09:00 and shows every desktop event", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Desktop Month expansion");
  await page.goto("/");
  await page.getByRole("button", { name: "Month" }).click();

  const emptyDate = page.getByRole("button", { name: /, no events$/ }).nth(10);
  await emptyDate.click();
  const editor = page.getByRole("dialog", { name: "Add event" });
  await expect(editor.getByLabel("Starts")).toHaveValue("09:00");
  await editor.getByLabel("Event title").fill("Month plan");
  await editor.getByRole("button", { name: "Save event" }).click();
  await expect(page.getByRole("button", { name: /Month plan/ })).toBeVisible();

  const today = await todayKey(page);
  await replaceCalendar(
    page,
    Array.from({ length: 9 }, (_, index) =>
      allDayEvent(`busy-${index}`, `Busy item ${index + 1}`, today),
    ),
  );
  await page.getByRole("button", { name: "Month" }).click();
  for (let index = 1; index <= 9; index += 1) {
    await expect(page.getByRole("button", { name: `Busy item ${index}, All day` })).toBeVisible();
  }
});

test("opens busy Month dates inline on mobile", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "Mobile inline details");
  await page.goto("/");
  const today = await todayKey(page);
  await replaceCalendar(page, [allDayEvent("mobile-busy", "Mobile detail", today)]);
  await page.getByRole("button", { name: "Month" }).click();

  await expect(page.getByText("Mobile detail")).toBeHidden();
  await page.getByRole("button", { name: /, 1 events$/ }).click();
  await expect(page.getByRole("button", { name: "Mobile detail, All day" })).toBeVisible();
  await page.getByRole("button", { name: "Add event" }).last().click();
  await expect(page.getByRole("dialog", { name: "Add event" }).getByLabel("Starts")).toHaveValue("09:00");
});

test("uses the mobile day strip for tap, keyboard, and swipe navigation", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "Mobile Week navigation");
  await page.goto("/");
  const selectedColumn = page.locator('[data-date-key][data-selected]');
  const originalDate = await selectedColumn.getAttribute("data-date-key");
  const dayButton = page
    .getByLabel("Week view")
    .locator(":scope > div")
    .first()
    .getByRole("button")
    .nth(2);
  await dayButton.click();
  await dayButton.focus();
  await page.keyboard.press("ArrowRight");
  await expect(selectedColumn).not.toHaveAttribute("data-date-key", originalDate ?? "");

  const afterKeyboard = await selectedColumn.getAttribute("data-date-key");
  const box = await page.getByLabel("Week view").boundingBox();
  if (!box) throw new Error("Week view is not visible");
  await page.mouse.move(box.x + box.width - 20, box.y + 180);
  await page.mouse.down();
  await page.mouse.move(box.x + 20, box.y + 180, { steps: 5 });
  await page.mouse.up();
  await expect(selectedColumn).not.toHaveAttribute("data-date-key", afterKeyboard ?? "");
});

test("searches chronologically, preserves the view, and opens the editor", async ({
  page,
}) => {
  await page.goto("/");
  const today = await todayKey(page);
  const now = new Date().toISOString();
  await replaceCalendar(page, [
    {
      id: "search-target",
      title: "Search target",
      timing: {
        kind: "timed",
        startsAt: `${addDays(today, 20)}T12:00:00+00:00[UTC]`,
        durationMinutes: 60,
      },
      recurrence: null,
      location: "Library",
      color: "mint",
      createdAt: now,
      updatedAt: now,
    },
  ]);
  await page.getByRole("button", { name: "Month" }).click();
  await page.getByRole("button", { name: "Search events" }).click();
  await page.getByRole("searchbox", { name: "Search events" }).fill("Library");
  await page
    .getByLabel("Search results")
    .getByRole("button", { name: /Search target/ })
    .click();

  await expect(page.getByRole("dialog", { name: "Edit event" })).toBeVisible();
  await page.getByRole("button", { name: "Close editor" }).click();
  await expect(
    page.getByRole("button", { name: "Month", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("searchbox", { name: "Search events" })).toHaveCount(0);
});

test("edits recurrence scopes and restores a deletion", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add event", exact: true }).click();
  await page.getByLabel("Event title").fill("Weekly sync");
  await page.getByRole("button", { name: "Weekly", exact: true }).click();
  await page.getByRole("button", { name: "Save event" }).click();

  await page.getByRole("button", { name: /Weekly sync/ }).first().click();
  const title = page.getByLabel("Event title");
  await title.fill("Special sync");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByRole("button", { name: "This occurrence" }).click();
  await expect(page.getByRole("button", { name: /Special sync/ }).first()).toBeVisible();

  await page.getByRole("button", { name: /Special sync/ }).first().click();
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "This occurrence" }).click();
  await expect(page.getByRole("button", { name: /Special sync/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("button", { name: /Special sync/ }).first()).toBeVisible();
});

test("imports, exports, persists themes, and passes Axe in light and dark", async ({
  page,
}) => {
  await page.goto("/");
  const today = await todayKey(page);
  const now = new Date().toISOString();
  const imported = {
    exportedAt: now,
    calendar: {
      version: 1,
      revision: 12,
      updatedAt: now,
      events: [allDayEvent("imported-reading", "Imported reading", today)],
    },
  };

  await page.getByRole("button", { name: "Settings" }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "calendario.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(imported)),
  });
  await expect(page.getByRole("status")).toContainText("Calendar imported.");
  await expect(page.getByRole("button", { name: /Imported reading/ })).toBeVisible();

  await page.getByRole("button", { name: "Settings" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  expect((await downloadPromise).suggestedFilename()).toMatch(
    /^calendario-\d{4}-\d{2}-\d{2}\.json$/,
  );

  await settleAnimations(page);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  // One click flips the theme, in either direction.
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await settleAnimations(page);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute(
    "data-theme-preference",
    "dark",
  );

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "System" }).click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-theme-preference",
    "system",
  );
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
