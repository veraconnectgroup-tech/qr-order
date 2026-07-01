import { expect, test } from "@playwright/test";

test.describe("Landing page", () => {
  test("shows Denis hero section with AI waiter headline", async ({ page }) => {
    await page.goto("/?lang=sr");

    await expect(page.getByText("Denis · Part of Vera Group")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Denis — AI konobar/i })
    ).toBeVisible();
    await expect(page.getByText(/nikad ne spava/i)).toBeVisible();
  });

  test("primary CTA links to signup", async ({ page }) => {
    await page.goto("/?lang=en");

    const cta = page.getByRole("link", { name: /Try for free|Start free/i }).first();
    await expect(cta).toHaveAttribute("href", "/signup");
  });

  test("nav links point to platform, enterprise, pricing, and faq", async ({ page }) => {
    await page.goto("/?lang=en");

    const headerNav = page.getByRole("banner").getByRole("navigation");

    await expect(headerNav.getByRole("link", { name: "Platform" })).toHaveAttribute(
      "href",
      "#features-guest"
    );
    await expect(headerNav.getByRole("link", { name: "Enterprise" })).toHaveAttribute(
      "href",
      "#enterprise"
    );
    await expect(headerNav.getByRole("link", { name: "Pricing" })).toHaveAttribute(
      "href",
      "#pricing"
    );
    await expect(headerNav.getByRole("link", { name: "FAQ" })).toHaveAttribute(
      "href",
      "#faq"
    );
  });

  test("interactive Denis demo advances on chip tap", async ({ page }) => {
    await page.goto("/?lang=en");

    await page.getByRole("button", { name: "Burger & beer" }).click();
    await expect(page.getByText("Burger and a beer")).toBeVisible();
  });

  test("footer legal links use correct URLs", async ({ page }) => {
    await page.goto("/");

    const footer = page.getByRole("contentinfo");
    await footer.scrollIntoViewIfNeeded();

    await expect(footer.getByRole("link", { name: /Privacy|Datenschutz/i })).toHaveAttribute(
      "href",
      "/datenschutz"
    );
  });

  test("responsive layout exposes main landmarks", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    await expect(page.locator("main#main-content")).toBeVisible();
    await expect(page.getByRole("banner")).toBeVisible();
  });
});
