import { expect, test, type Page } from "@playwright/test";

const DEMO_PATH = "/skyline-lounge/demo-table-8";
const DEMO_LANG_KEY = "qr_lang_demo-location";

async function openDemoMenu(page: Page) {
  await page.addInitScript((key) => {
    localStorage.setItem(key, "en");
  }, DEMO_LANG_KEY);
  await page.goto(DEMO_PATH);
}

test.describe("Guest ordering flow (demo menu)", () => {
  test("loads menu, updates cart, and shows VAT on checkout", async ({ page }) => {
    await openDemoMenu(page);

    await expect(page.getByText("Aperol Spritz").first()).toBeVisible();

    await page.getByRole("button", { name: "Add Aperol Spritz" }).click();

    await expect(page.getByRole("link", { name: /view cart/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /view cart/i })).toContainText("1");

    await page.getByRole("link", { name: /view cart/i }).click();
    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.getByText("Aperol Spritz").first()).toBeVisible();

    await page.getByRole("link", { name: /place order/i }).click();
    await expect(page).toHaveURL(/\/checkout$/);

    await expect(page.getByText(/VAT 19%/)).toBeVisible();
  });
});
