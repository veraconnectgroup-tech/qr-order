import { expect, test } from "@playwright/test";

test.describe("Landing page", () => {
  test("shows Denis hero section", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("Denis · Part of Vera Group")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Hospitality operations/i })
    ).toBeVisible();
    await expect(
      page.getByText(/designed for the floor, not for demos/i)
    ).toBeVisible();
  });

  test("nav links point to platform, enterprise, and pricing", async ({ page }) => {
    await page.goto("/");

    const headerNav = page.getByRole("banner").getByRole("navigation");

    await expect(headerNav.getByRole("link", { name: "Platform" })).toHaveAttribute(
      "href",
      "#features-guest"
    );
    await expect(headerNav.getByRole("link", { name: "Enterprise" })).toHaveAttribute(
      "href",
      "/enterprise"
    );
    await expect(headerNav.getByRole("link", { name: "Pricing" })).toHaveAttribute(
      "href",
      "#pricing"
    );

    await headerNav.getByRole("link", { name: "Enterprise" }).click();
    await expect(page).toHaveURL(/\/enterprise$/);
  });

  test("footer legal links use correct URLs", async ({ page }) => {
    await page.goto("/");

    const footer = page.getByRole("contentinfo");
    await footer.scrollIntoViewIfNeeded();

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
