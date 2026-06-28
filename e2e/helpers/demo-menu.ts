import { expect, type Page } from "@playwright/test";

export const DEMO_PATH = "/skyline-lounge/demo-table-8";
export const DEMO_LANG_KEY = "qr_lang_demo-location";
/** Matches GuestSwCacheReset RESET_STORAGE_KEY — skip SW hard reload in prod e2e. */
export const GUEST_SW_RESET_KEY = "guest-sw-reset-v4";

export async function openDemoMenu(page: Page) {
  await page.addInitScript(
    ({ langKey, swResetKey }) => {
      localStorage.setItem(langKey, "en");
      localStorage.setItem(swResetKey, "1");
    },
    { langKey: DEMO_LANG_KEY, swResetKey: GUEST_SW_RESET_KEY }
  );

  await page.goto(DEMO_PATH, { waitUntil: "domcontentloaded" });

  const englishButton = page.getByRole("button", { name: "English" });
  if (await englishButton.isVisible().catch(() => false)) {
    await englishButton.click();
  }

  await expect(page.locator("#main-content")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Aperol Spritz").first()).toBeVisible({
    timeout: 15_000,
  });
}
