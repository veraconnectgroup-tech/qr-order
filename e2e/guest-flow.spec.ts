import { expect, test } from "@playwright/test";

const DEMO_PATH = "/skyline-lounge/demo-table-8";

test.describe("Guest ordering flow (demo menu)", () => {
  test("loads menu, updates cart, and shows MwSt on checkout", async ({ page }) => {
    await page.goto(DEMO_PATH);

    await expect(page.getByText("Aperol Spritz").first()).toBeVisible();

    await page.getByRole("button", { name: "Add Aperol Spritz" }).click();

    await expect(page.getByRole("link", { name: /view cart/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /view cart/i })).toContainText("1");

    await page.getByRole("link", { name: /view cart/i }).click();
    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.getByText("Aperol Spritz")).toBeVisible();

    await page.getByRole("link", { name: /place order/i }).click();
    await expect(page).toHaveURL(/\/checkout$/);

    await expect(page.getByText(/MwSt 19%/)).toBeVisible();
  });
});
