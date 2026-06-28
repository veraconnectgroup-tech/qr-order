import { describe, expect, it } from "vitest";
import {
  landingCopy,
  LANDING_LOCALES,
  resolveLandingLocale,
} from "@/lib/landing/landing-copy";
import {
  computeLandingRoiEstimate,
  formatLandingEuros,
} from "@/lib/landing/landing-roi-calculator";
import { landingJsonLd } from "@/lib/landing/landing-seo";

describe("landing page (Prompt 80)", () => {
  it("supports DE, EN, and SR locales with hero Denis headline", () => {
    for (const locale of LANDING_LOCALES) {
      const copy = landingCopy(locale);
      expect(copy.hero.title.length).toBeGreaterThan(0);
      expect(copy.hero.cta).toMatch(/signup|besplatno|free|starten|testen/i);
      expect(copy.pricing.plans).toHaveLength(3);
      expect(copy.features).toHaveLength(4);
      expect(copy.faq.items.length).toBeGreaterThanOrEqual(6);
    }

    expect(landingCopy("sr").hero.titleAccent).toMatch(/nikad ne spava/i);
  });

  it("resolveLandingLocale maps browser codes", () => {
    expect(resolveLandingLocale("de-DE")).toBe("de");
    expect(resolveLandingLocale("sr-RS")).toBe("sr");
    expect(resolveLandingLocale("en-US")).toBe("en");
  });

  it("CTA plans link to signup flow", () => {
    const standard = landingCopy("en").pricing.plans.find((p) => p.primary);
    expect(standard?.href).toBe("/signup");
    expect(standard?.cta.toLowerCase()).toContain("free");
  });

  it("ROI calculator estimates monthly uplift", () => {
    const roi = computeLandingRoiEstimate({
      coversPerDay: 100,
      averageTicketEuros: 30,
      upsellUpliftPercent: 10,
      planCostEuros: 49,
    });

    expect(roi.monthlyUpliftEuros).toBe(9000);
    expect(roi.roiMultiplier).toBeGreaterThan(100);
    expect(formatLandingEuros(9000, "en")).toMatch(/€/);
  });

  it("exports JSON-LD for SEO", () => {
    const json = landingJsonLd("de");
    expect(json["@type"]).toBe("SoftwareApplication");
    expect(json.name).toBe("Denis");
  });

  it("social proof includes 1000+ orders stat", () => {
    const stat = landingCopy("sr").social.stats.find((row) =>
      row.label.toLowerCase().includes("narudž")
    );
    expect(stat?.value).toBeGreaterThanOrEqual(1000);
    expect(stat?.suffix).toBe("+");
  });

  it("pricing feature matrix has three columns", () => {
    const matrix = landingCopy("en").pricing.featureMatrix;
    expect(matrix.headers).toHaveLength(3);
    expect(matrix.rows.length).toBeGreaterThanOrEqual(4);
  });
});
