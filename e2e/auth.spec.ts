import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("sends signed-out visitors to the login page and removes /chat", async ({
  page,
  request,
}) => {
  // The landing is public; the views behind it are not.
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Everything you planned/ }),
  ).toBeVisible();

  await page.goto("/calendar");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

  expect((await request.get("/chat")).status()).toBe(404);
});

test("passes Axe on the login page", async ({ page }) => {
  await page.goto("/login");
  await expect(
    page.getByRole("button", { name: "Sign in with Google Calendar" }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
