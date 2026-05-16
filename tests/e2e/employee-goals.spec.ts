import { test, expect } from "@playwright/test";
import { signInAs } from "./fixtures/sign-in";
import { resetDb } from "./fixtures/db";

// Run sequentially so the goal-sheet state mutations from earlier tests
// don't leak into later tests within this file.
test.describe.configure({ mode: "serial" });

test.describe("employee goal sheet", () => {
  test.beforeAll(() => {
    // Wipe + reseed so the employee starts in a clean draft state.
    // Diego Alvarez (DEMO_USERS.employee) is seeded with a draft sheet.
    resetDb();
  });

  test.beforeEach(async ({ page }) => {
    await signInAs(page, "employee");
  });

  test("loads goal sheet", async ({ page }) => {
    await page.goto("/goals");
    const main = page.locator("main");
    await expect(main.getByRole("heading", { name: /my goals/i })).toBeVisible();

    // Click into the editor — there's an "Open editor" button near the top
    // and the sheet row also links to /goals/[sheetId].
    const editorLink = main.getByRole("link", { name: /open editor/i }).first();
    await expect(editorLink).toBeVisible();
    await editorLink.click();

    await page.waitForURL(/\/goals\/[\w-]+/, { timeout: 10_000 });
    await expect(main.getByText(/goals/i).first()).toBeVisible();
    // Either the validation summary tile or the weightage sum tile should
    // render. We assert via the "Sum" tile label.
    await expect(main.getByText(/sum/i).first()).toBeVisible();
  });

  test("validators block submit", async ({ page }) => {
    await page.goto("/goals");
    await page.getByRole("link", { name: /open editor/i }).first().click();
    await page.waitForURL(/\/goals\/[\w-]+/);

    // Bump the weight of the first goal upward via the increment button so the
    // total weight no longer equals 100%.
    const inc = page.getByRole("button", { name: /^increment$/i }).first();
    await expect(inc).toBeVisible();
    await inc.click();
    await inc.click(); // +10% — total now 110%

    // Submit button should be disabled because validators are unhappy.
    const submitBtn = page.getByRole("button", { name: /submit for approval|^submit$/i }).first();
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toBeDisabled();

    // And the validation list should surface the weightage issue.
    await expect(
      page.getByText(/total weightage must be 100|weight|issue/i).first(),
    ).toBeVisible();
  });

  test("submits when valid", async ({ page }) => {
    await page.goto("/goals");
    await page.getByRole("link", { name: /open editor/i }).first().click();
    await page.waitForURL(/\/goals\/[\w-]+/);

    // The seeded draft is already 100% — auto-balance is a safe no-op that
    // also normalises any drift from a previous test's leftover state.
    const autoBalance = page.getByRole("button", { name: /auto-balance/i });
    if (await autoBalance.isVisible().catch(() => false)) {
      await autoBalance.click();
    }

    const submitBtn = page.getByRole("button", { name: /submit for approval|^submit$/i }).first();
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toBeEnabled();

    await submitBtn.click();

    // After submit, the sheet status badge transitions out of "Draft".
    // The label for `submitted` is "Awaiting review" (see SHEET_STATUS_LABELS),
    // and the page also shows "in_review" / "Submitted …" copy elsewhere.
    await expect(
      page.getByText(/awaiting review|in review|submitted/i).first(),
    ).toBeVisible({ timeout: 15_000 });
  });
});
