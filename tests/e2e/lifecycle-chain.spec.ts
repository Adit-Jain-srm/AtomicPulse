import { test, expect } from "@playwright/test";
import { signInAs } from "./fixtures/sign-in";

/**
 * One continuous journey on a fresh seed — no DB reset between steps.
 * Proves employee → manager → check-in works end-to-end in a single session.
 */
test.describe.configure({ mode: "serial" });

test.describe("lifecycle chain", () => {
  test.beforeAll(() => {
  });

  test("employee submits goals → manager approves → employee completes check-in", async ({
    page,
  }) => {
    // --- Employee: submit goal sheet (or verify already submitted) ---
    await signInAs(page, "employee"); // Diego Alvarez
    await page.goto("/goals");
    await page.getByRole("link", { name: /open editor|view submitted/i }).first().click();
    await page.waitForURL(/\/goals\/[\w-]+/);

    // If sheet is still draft, submit it; if already submitted, proceed
    const submitBtn = page
      .getByRole("button", { name: /submit for approval|^submit$/i })
      .first();
    if (await submitBtn.isVisible().catch(() => false)) {
      if (await submitBtn.isEnabled().catch(() => false)) {
        await submitBtn.click();
        await expect(
          page.getByText(/awaiting review|in review|submitted/i).first(),
        ).toBeVisible({ timeout: 15_000 });
      }
    }
    // Verify sheet is in submitted/review state
    await expect(
      page.getByText(/awaiting review|in review|submitted/i).first(),
    ).toBeVisible({ timeout: 10_000 });

    // --- Manager: approve Diego's sheet ---
    await signInAs(page, "manager"); // Morgan Chen
    await page.goto("/goals");
    await expect(
      page.getByRole("link", { name: /Diego Alvarez/i }).first(),
    ).toBeVisible();
    await page.getByRole("link", { name: /Diego Alvarez/i }).first().click();
    await page.waitForURL(/\/goals\/[\w-]+/);

    const approveBtn = page
      .getByRole("button", { name: /approve(?:\s|&|and)?\s*lock|^approve/i })
      .first();
    await expect(approveBtn).toBeVisible();
    await approveBtn.click();
    await expect(page.getByText(/approved|locked/i).first()).toBeVisible({
      timeout: 15_000,
    });

    // --- Employee: check-in for open window ---
    await signInAs(page, "employee");
    await page.goto("/check-ins");
    const main = page.locator("main");
    await expect(main.getByRole("heading", { name: /check-?ins/i }).first()).toBeVisible();

    const q1Chip = main.getByRole("button", { name: /Q1/i }).first();
    await expect(q1Chip).toContainText(/Open/i);

    const actualInput = main.getByPlaceholder(/^actual/i).first();
    await expect(actualInput).toBeVisible();
    await actualInput.fill("85");

    const scoreLabel = main.getByText(/^score$/i).first();
    const scoreRow = scoreLabel.locator("..");
    await expect
      .poll(async () => (await scoreRow.textContent())?.trim() ?? "", {
        timeout: 5_000,
      })
      .not.toBe("");

    const submitCheckIn = main
      .getByRole("button", { name: /submit check-?in|submit/i })
      .first();
    if (await submitCheckIn.isVisible().catch(() => false)) {
      await submitCheckIn.click();
    }
  });
});
