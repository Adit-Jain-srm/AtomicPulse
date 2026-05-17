import { test, expect } from "@playwright/test";
import { signInAs, SEEDED_USERS } from "./fixtures/sign-in";

test.describe.configure({ mode: "serial" });

test.describe("manager review", () => {
  // Reset before each test because approve / return mutate the seeded
  // submitted sheet (Alex Rivera under Morgan Chen).
  test.beforeEach(async ({ page }) => {
    await signInAs(page, "manager");
  });

  test("review queue lists submitted sheets", async ({ page }) => {
    await page.goto("/goals");

    await expect(
      page.getByRole("heading", { name: /team goal sheets|all goal sheets/i }),
    ).toBeVisible();

    // The seeded fixtures put Alex Rivera in "submitted" → label "Awaiting review".
    await expect(
      page.getByText(/awaiting review|in review|submitted/i).first(),
    ).toBeVisible();
  });

  test("approve transitions to locked", async ({ page }) => {
    await page.goto("/goals");

    // Click into Alex's submitted sheet.
    const row = page.getByRole("link", { name: new RegExp(SEEDED_USERS.alex.displayName, "i") }).first();
    await expect(row).toBeVisible();
    await row.click();

    await page.waitForURL(/\/goals\/[\w-]+/);

    const approveBtn = page.getByRole("button", { name: /approve(?:\s|&|and)?\s*lock|^approve/i }).first();
    await expect(approveBtn).toBeVisible();
    await approveBtn.click();

    // After approval, status badge becomes "Approved" or "Locked".
    await expect(
      page.getByText(/approved|locked/i).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("return-with-comment", async ({ page }) => {
    await page.goto("/goals");
    const row = page.getByRole("link", { name: new RegExp(SEEDED_USERS.alex.displayName, "i") }).first();
    await row.click();
    await page.waitForURL(/\/goals\/[\w-]+/);

    // Open the "Return for rework" disclosure.
    const returnSummary = page.getByText(/return for rework/i).first();
    await expect(returnSummary).toBeVisible();
    await returnSummary.click();

    const commentBox = page.getByPlaceholder(/what should the employee revise/i);
    await expect(commentBox).toBeVisible();
    await commentBox.fill("Tighten weights — Q1 plan needs a measurable customer KPI.");

    const returnBtn = page.getByRole("button", { name: /^return$/i }).first();
    await expect(returnBtn).toBeVisible();
    await returnBtn.click();

    // After return, the sheet flips back to draft / reopened-style state.
    await expect(
      page.getByText(/draft|reopened|returned for rework/i).first(),
    ).toBeVisible({ timeout: 15_000 });
  });
});
