import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { openDemoMenu } from "./helpers/demo-menu";

test.describe("Guest accessibility (WCAG 2.1 AA)", () => {
  test("menu page has no critical axe violations", async ({ page }) => {
    await openDemoMenu(page);

    await expect(page.getByText("Aperol Spritz").first()).toBeVisible({
      timeout: 15_000,
    });

    const results = await new AxeBuilder({ page })
      .include("#main-content")
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const critical = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );
    expect(critical, JSON.stringify(critical, null, 2)).toEqual([]);
  });
});
