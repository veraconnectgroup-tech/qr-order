import { expect, test, type Page } from "@playwright/test";

const DEMO_PATH = "/skyline-lounge/demo-table-8";
const DEMO_LANG_KEY = "qr_lang_demo-location";

/** English, German, or cart-style VAT labels for 19%. */
const TAX_19 = /Tax \(19%\)|VAT 19%|MwSt \(19%\)|MwSt 19%/i;

async function openDemoMenu(page: Page) {
  await page.addInitScript((key) => {
    localStorage.setItem(key, "en");
  }, DEMO_LANG_KEY);
  await page.goto(DEMO_PATH);

  const englishButton = page.getByRole("button", { name: "English" });
  if (await englishButton.isVisible().catch(() => false)) {
    await englishButton.click();
  }
}

async function expectTaxLine(page: Page) {
  const taxLine = page.getByTestId("checkout-tax-line").or(
    page.getByTestId("cart-tax-line")
  );
  await expect(taxLine.first()).toBeVisible({ timeout: 15_000 });
  await expect(taxLine.first()).toHaveText(TAX_19);
}

test.describe("Guest ordering flow (demo menu)", () => {
  test("loads menu, updates cart, and shows tax on checkout", async ({ page }) => {
    await openDemoMenu(page);

    await expect(page.getByText("Aperol Spritz").first()).toBeVisible();

    await page.getByRole("button", { name: "Add Aperol Spritz" }).click();

    const cartLink = page.getByRole("link", {
      name: /items, total|Artikel, Gesamt/i,
    });
    await expect(cartLink).toBeVisible();
    await expect(cartLink).toContainText(/1/);
    await cartLink.click();
    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.getByText("Aperol Spritz").first()).toBeVisible();
    await expectTaxLine(page);

    await page.getByRole("link", { name: /place order/i }).click();
    await expect(page).toHaveURL(/\/checkout$/);
    await expect(
      page.getByText(/Order summary|Bestellübersicht/i)
    ).toBeVisible({ timeout: 15_000 });
    await expectTaxLine(page);
  });
});
