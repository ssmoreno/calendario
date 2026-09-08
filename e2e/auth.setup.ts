import { expect, test as setup } from "@playwright/test";

import { E2E_ACCOUNTS, E2E_PASSWORD } from "./credentials";

/**
 * Signs each project's account in once. The account may already exist from a
 * previous run or from `pnpm db:seed`, so a rejected sign-up is expected
 * rather than fatal.
 */
for (const [project, account] of Object.entries(E2E_ACCOUNTS)) {
  setup(`authenticate ${project}`, async ({ page, request }) => {
    const signUp = await request.post("/api/auth/sign-up/email", {
      data: {
        email: account.email,
        password: E2E_PASSWORD,
        name: account.name,
      },
      failOnStatusCode: false,
    });
    if (!signUp.ok() && signUp.status() !== 422) {
      throw new Error(
        `Unexpected sign-up response ${signUp.status()}: ${await signUp.text()}`,
      );
    }

    const signIn = await page.request.post("/api/auth/sign-in/email", {
      data: { email: account.email, password: E2E_PASSWORD },
    });
    if (!signIn.ok()) {
      throw new Error(
        `Unexpected sign-in response ${signIn.status()}: ${await signIn.text()}`,
      );
    }

    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: "SS", exact: true }),
    ).toBeVisible();
    const userId = await page.evaluate(async () => {
      const response = await fetch("/api/auth/get-session");
      const session = (await response.json()) as { user?: { id?: string } };
      if (!session.user?.id) throw new Error("Authenticated user id missing.");
      return session.user.id;
    });
    await page.evaluate((id) => {
      localStorage.setItem("calendario.e2e.userId", id);
    }, userId);
    await page.context().storageState({ path: account.storageState });
  });
}
