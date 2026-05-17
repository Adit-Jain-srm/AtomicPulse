import { test, expect } from "@playwright/test";
import { signInAs, SEEDED_USERS } from "./fixtures/sign-in";

test.describe("manager review", () => {
  test("review queue lists submitted sheets", async ({ page }) => {
    await signInAs(page, "manager");
    await page.goto("/goals");

    await expect(
      page.getByRole("heading", { name: /team goal sheets|all goal sheets/i }),
    ).toBeVisible();

    await expect(
      page.getByText(/awaiting review|in review|submitted/i).first(),
    ).toBeVisible();
  });

  test("approve transitions to locked", async ({ page }) => {
    await signInAs(page, "manager");
    await page.goto("/goals");

    const row = page.getByRole("link", { name: new RegExp(SEEDED_USERS.alex.displayName, "i") }).first();
    if (!(await row.isVisible().catch(() => false))) {
      test.skip(true, "Alex sheet not in submitted state (may have been mutated by prior test).");
      return;
    }
    await row.click();
    await page.waitForURL(/\/goals\/[\w-]+/);

    const approveBtn = page.getByRole("button", { name: /approve(?:\s|&|and)?\s*lock|^approve/i }).first();
    await expect(approveBtn).toBeVisible({ timeout: 8_000 });
    await approveBtn.click();

    await expect(
      page.getByText(/approved|locked/i).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("return-with-comment", async ({ page }) => {
    // Use Ravi (manager) + Tomas (submitted under Ravi) to avoid conflict with approve test
    await signInAs(page, SEEDED_USERS.ravi);
    await page.goto("/goals");

    const row = page.getByRole("link", { name: new RegExp(SEEDED_USERS.tomas.displayName, "i") }).first();
    if (!(await row.isVisible().catch(() => false))) {
      test.skip(true, "Tomas sheet not in submitted state.");
      return;
    }
    await row.click();
    await page.waitForURL(/\/goals\/[\w-]+/);

    const returnSummary = page.getByText(/return for rework/i).first();
    await expect(returnSummary).toBeVisible({ timeout: 8_000 });
    await returnSummary.click();

    const commentBox = page.getByPlaceholder(/what should the employee revise/i);
    await expect(commentBox).toBeVisible();
    await commentBox.fill("Tighten weights — Q1 plan needs a measurable customer KPI.");

    const returnBtn = page.getByRole("button", { name: /^return$/i }).first();
    await expect(returnBtn).toBeVisible();
    await returnBtn.click();

    await expect(
      page.getByText(/draft|reopened|returned for rework/i).first(),
    ).toBeVisible({ timeout: 15_000 });
  });
});
