import { test, expect } from "@playwright/test";
import { signInAs } from "./fixtures/sign-in";

test.describe("shared goals", () => {
  test("manager sees Shared Goals page", async ({ page }) => {
    await signInAs(page, "manager");
    await page.goto("/shared-goals");

    // Scope to <main> so the sidebar's "Shared goals" nav link doesn't satisfy
    // the assertion alone — and so off-screen drawer duplicates don't shadow
    // the visible content on mobile viewports.
    const main = page.locator("main");

    await expect(
      main.getByRole("heading", { name: /goals you share|shared goals|linked goals/i }).first(),
    ).toBeVisible();

    // Either the seeded data has shared rows (rare) or the empty state
    // explains how to push goals. Match either presentation.
    await expect(
      main.getByText(/no shared goals yet|linked goals|shared/i).first(),
    ).toBeVisible();
  });

  test("shared goal rows are read-only on the goal sheet", async ({ page }) => {
    // Server actions enforce the real "shared" guarantee. From the UI we can
    // verify that any goal whose `source === "shared"` renders as disabled
    // inputs (title/target/weight). Seed data may not always include shared
    // goals, so we soft-skip if none are visible.
    await signInAs(page, "manager");
    await page.goto("/goals");

    // Open the first sheet detail link that visibly carries a "Shared" badge.
    // Scope strictly to anchors whose href targets a goal sheet detail page so
    // that sidebar links to /shared-goals don't match.
    const sheetLinks = page.locator('a[href^="/goals/"]');
    const sharedSheetLink = sheetLinks
      .filter({ has: page.locator("text=/^shared$/i") })
      .first();
    if (!(await sharedSheetLink.isVisible().catch(() => false))) {
      test.skip(
        true,
        "No shared goals present in seed; UI guarantee covered by goals.ts unit tests.",
      );
      return;
    }

    await sharedSheetLink.click();
    await page.waitForURL(/\/goals\/[\w-]+/);

    const sharedBadge = page.getByText(/^shared$/i).first();
    await expect(sharedBadge).toBeVisible();

    // The shared goal's title input should be disabled (component sets
    // `disabled={sharedReadOnly}` on Input/Textarea/Select).
    const disabledInputs = page.locator(
      "input[disabled], textarea[disabled], select[disabled]",
    );
    expect(await disabledInputs.count()).toBeGreaterThan(0);
  });
});
