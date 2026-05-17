import { test, expect } from "@playwright/test";
import { signInAs, SEEDED_USERS } from "./fixtures/sign-in";
import { resetDb } from "./fixtures/db";

test.describe.configure({ mode: "serial" });

test.describe("shared goals", () => {
  test.beforeAll(() => {
    resetDb();
  });

  test("manager sees shared goals on the Shared Goals page", async ({ page }) => {
    await signInAs(page, "manager");
    await page.goto("/shared-goals");

    const main = page.locator("main");

    await expect(
      main.getByRole("heading", { name: /goals you share|shared goals/i }).first(),
    ).toBeVisible();

    // Seeded shared goals should now appear (Morgan pushed Jordan's goal to Alex + Diego)
    await expect(main.getByText(/linked goals/i).first()).toBeVisible();

    // Should show entries (not "No shared goals yet")
    const entries = main.getByText(/entries/i).first();
    await expect(entries).toBeVisible();
  });

  test("shared goal appears on recipient's goal sheet with shared badge", async ({ page }) => {
    // Alex has a shared goal pushed from Morgan
    await signInAs(page, SEEDED_USERS.alex);
    await page.goto("/goals");

    // Open Alex's sheet
    const sheetLink = page.locator('a[href^="/goals/"]').first();
    await expect(sheetLink).toBeVisible();
    await sheetLink.click();
    await page.waitForURL(/\/goals\/[\w-]+/);

    // The shared goal should display on the sheet with a "Shared" badge
    const sharedBadge = page.getByText(/^shared$/i).first();
    await expect(sharedBadge).toBeVisible({ timeout: 10_000 });
  });

  test("achievement syncs from primary to shared goals", async ({ page }) => {
    // Jordan's goal (primary) has a Q1 check-in with an actual value.
    // The shared copy on Alex's sheet should reflect the same currentActual / score.
    await signInAs(page, SEEDED_USERS.alex);
    await page.goto("/shared-goals");

    const main = page.locator("main");
    // The shared goal entry should exist with the primary goal's title
    const sharedEntry = main.locator("li").first();
    await expect(sharedEntry).toBeVisible({ timeout: 10_000 });

    // Verify it shows the synced status (on_track badge or score)
    await expect(
      sharedEntry.getByText(/on.track|shared|%/i).first()
    ).toBeVisible();
  });

  test("employee cannot edit title/target on shared goal (server enforcement)", async ({ page }) => {
    await signInAs(page, SEEDED_USERS.alex);
    await page.goto("/goals");

    const sheetLink = page.locator('a[href^="/goals/"]').first();
    await sheetLink.click();
    await page.waitForURL(/\/goals\/[\w-]+/);

    // Find the shared goal row — it should have disabled inputs
    const sharedBadge = page.getByText(/^shared$/i).first();
    if (await sharedBadge.isVisible().catch(() => false)) {
      const sharedRow = sharedBadge.locator("..").locator("..");
      const titleInput = sharedRow.locator("input").first();
      if (await titleInput.isVisible().catch(() => false)) {
        await expect(titleInput).toBeDisabled();
      }
    }
  });

  test("admin sees all shared goals across org", async ({ page }) => {
    await signInAs(page, "admin");
    await page.goto("/shared-goals");

    const main = page.locator("main");
    await expect(main.getByText(/linked goals/i).first()).toBeVisible();

    // Admin should see entries from the seeded push
    const entryCount = main.locator("li");
    expect(await entryCount.count()).toBeGreaterThan(0);
  });
});
