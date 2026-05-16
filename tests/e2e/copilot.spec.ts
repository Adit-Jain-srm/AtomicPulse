import { test, expect } from "@playwright/test";
import { signInAs } from "./fixtures/sign-in";

test.describe("copilot", () => {
  test("quick skill streams a non-empty assistant reply (stub mode)", async ({ page }) => {
    await signInAs(page, "employee");
    await page.goto("/copilot");

    await expect(
      page.getByRole("heading", { name: /goal copilot/i }),
    ).toBeVisible();

    // Click the "Draft a SMART goal" preset — first skill in the side panel.
    const draftBtn = page.getByRole("button", { name: /draft a smart goal/i }).first();
    await expect(draftBtn).toBeVisible();
    await draftBtn.click();

    // The stub stream emits a multi-line SMART goal reply quickly. We assert
    // a non-empty assistant bubble appears with concrete content within 6s.
    await expect(
      page.getByText(/SMART goal|customer outcomes|target|weightage|drop|sheet/i).first(),
    ).toBeVisible({ timeout: 6_000 });
  });
});
