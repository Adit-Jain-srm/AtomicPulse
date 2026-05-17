import { test, expect } from "@playwright/test";
import { signInAs, SEEDED_USERS } from "./fixtures/sign-in";

test.describe.configure({ mode: "serial" });

test.describe("check-ins", () => {
  test.beforeAll(() => {
    // Data comes from the initial db:seed run (CI seeds once before all tests).
  });

  test("check-in opens for current window", async ({ page }) => {
    await signInAs(page, SEEDED_USERS.jordan); // approved sheet → check-ins enabled
    await page.goto("/check-ins");

    await expect(
      page.getByRole("heading", { name: /check-?ins/i }).first(),
    ).toBeVisible();

    // Q1 is forced open in the seed; the chip carries an "Open" badge.
    const q1Chip = page.getByRole("button", { name: /Q1/i }).first();
    await expect(q1Chip).toBeVisible();
    await expect(q1Chip).toContainText(/Open/i);
  });

  test("submitting an actual recomputes the score", async ({ page }) => {
    await signInAs(page, SEEDED_USERS.jordan);
    await page.goto("/check-ins");

    // Locate the score block once so we can compare before/after text.
    const scoreLabel = page.getByText(/^score$/i).first();
    await expect(scoreLabel).toBeVisible();
    const scoreRow = scoreLabel.locator("..");
    const before = (await scoreRow.textContent())?.trim() ?? "";

    // Type into the first numeric Actual input.
    const actualInput = page.getByPlaceholder(/^actual/i).first();
    await expect(actualInput).toBeVisible();
    await actualInput.fill("");
    await actualInput.fill("420000");

    // Score is computed live from local state — should change immediately.
    await expect
      .poll(async () => (await scoreRow.textContent())?.trim() ?? "", {
        timeout: 5_000,
      })
      .not.toBe(before);
  });

  test("manager ack writes a comment", async ({ page }) => {
    await signInAs(page, "manager"); // Morgan Chen
    await page.goto("/check-ins");

    // From the manager check-ins index, click into Jordan's report to open
    // the per-owner ack view at /check-ins/[ownerId].
    const jordanLink = page
      .getByRole("link", { name: new RegExp(SEEDED_USERS.jordan.displayName, "i") })
      .first();
    await expect(jordanLink).toBeVisible();
    await jordanLink.click();

    await page.waitForURL(/\/check-ins\/[\w-]+/);

    // The seed inserts Q1 check-ins for approved sheets with employeeSubmittedAt
    // set, so the manager comment textarea + Acknowledge button are usable.
    const commentBox = page
      .getByPlaceholder(/acknowledge progress|name a blocker|comment/i)
      .first();
    await expect(commentBox).toBeVisible();
    const note = "Solid Q1 — keep momentum into Q2.";
    await commentBox.fill(note);

    const ackBtn = page.getByRole("button", { name: /acknowledge/i }).first();
    await expect(ackBtn).toBeVisible();
    await ackBtn.click();

    // The first check-in should now show an "Acked …" badge.
    await expect(
      page.getByText(/acked|acknowledged/i).first(),
    ).toBeVisible({ timeout: 15_000 });
  });
});
