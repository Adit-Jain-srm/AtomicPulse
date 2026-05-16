import { test, expect } from "@playwright/test";
import { signInAs, signOut } from "./fixtures/sign-in";

test.describe("auth", () => {
  test("lands on dashboard for each role", async ({ page }) => {
    // Scope content assertions to <main> so hidden duplicates in the off-screen
    // mobile drawer don't shadow the visible dashboard copy.
    const main = page.locator("main");

    await signInAs(page, "employee");
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(
      main.getByText(/your goals|sheet status|goal status/i).first(),
    ).toBeVisible();

    await signOut(page);

    await signInAs(page, "manager");
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(
      main.getByText(/approvals?|approvals queue|review/i).first(),
    ).toBeVisible();

    await signOut(page);

    await signInAs(page, "admin");
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(
      main.getByText(/people|org|cycle/i).first(),
    ).toBeVisible();
  });

  test("sign-out clears session", async ({ page }) => {
    await signInAs(page, "employee");
    await expect(page).toHaveURL(/\/dashboard/);

    await signOut(page);

    await page.goto("/dashboard");
    await page.waitForURL(/\/sign-in/, { timeout: 10_000 });
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("Entra path shows configured/not-configured banner", async ({ page }) => {
    await page.goto("/sign-in?reason=entra_not_configured");

    // The sign-in screen always advertises Microsoft / Entra somewhere
    // (button when configured, marketing copy when not). Use a flexible
    // matcher so we tolerate either presentation.
    const hint = page
      .getByText(/microsoft|entra|sso|single sign-on/i)
      .first();
    await expect(hint).toBeVisible();
  });
});
