import { expect, test } from "@playwright/test";

test.describe("Landing page", () => {
  test("shows hero section", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: /your shortcut to every order/i })
    ).toBeVisible();
  });

  test("nav links point to platform, enterprise, and pricing", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("navigation").getByRole("link", { name: "Platform" })).toHaveAttribute(
      "href",
      "#modules"
    );
    await expect(page.getByRole("navigation").getByRole("link", { name: "Enterprise" })).toHaveAttribute(
      "href",
      "/enterprise"
    );
    await expect(page.getByRole("navigation").getByRole("link", { name: "Pricing" })).toHaveAttribute(
      "href",
      "#pricing"
    );

    await page.getByRole("navigation").getByRole("link", { name: "Enterprise" }).click();
    await expect(page).toHaveURL(/\/enterprise$/);
  });

  test("footer legal links use correct URLs", async ({ page }) => {
    await page.goto("/");

    const footer = page.getByRole("contentinfo");

    await expect(footer.getByRole("link", { name: "Datenschutz" })).toHaveAttribute(
      "href",
      "/datenschutz"
    );
    await expect(footer.getByRole("link", { name: "AGB" })).toHaveAttribute(
      "href",
      "/agb"
    );
    await expect(footer.getByRole("link", { name: "Impressum" })).toHaveAttribute(
      "href",
      "/impressum"
    );
  });
});
