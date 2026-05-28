import { describe, expect, it } from "vitest";
import {
  REDUCED_VAT_RATE,
  STANDARD_VAT_RATE,
  calculateOrderTaxFromItems,
  grossTaxAmount,
  grossToNet,
  groupGrossByRate,
  lineVatBreakdown,
  resolveItemTaxRate,
} from "@/lib/tax/vat";

describe("resolveItemTaxRate", () => {
  it("applies 19% for drinks (dine-in)", () => {
    expect(
      resolveItemTaxRate({
        productTaxRate: REDUCED_VAT_RATE,
        menuSection: "drinks",
        isTakeaway: false,
      })
    ).toBe(STANDARD_VAT_RATE);
  });

  it("applies 19% for drinks (takeaway)", () => {
    expect(
      resolveItemTaxRate({
        productTaxRate: REDUCED_VAT_RATE,
        menuSection: "drinks",
        isTakeaway: true,
      })
    ).toBe(STANDARD_VAT_RATE);
  });

  it("applies 19% for food dine-in", () => {
    expect(
      resolveItemTaxRate({
        productTaxRate: null,
        menuSection: "food",
        isTakeaway: false,
      })
    ).toBe(STANDARD_VAT_RATE);
  });

  it("applies 7% for takeaway food with tax_rate=7", () => {
    expect(
      resolveItemTaxRate({
        productTaxRate: REDUCED_VAT_RATE,
        menuSection: "food",
        isTakeaway: true,
      })
    ).toBe(REDUCED_VAT_RATE);
  });
});

describe("gross-inclusive VAT", () => {
  it("extracts net and tax from gross line", () => {
    expect(grossToNet(11.9, 19)).toBe(10);
    expect(grossTaxAmount(11.9, 19)).toBe(1.9);
    expect(lineVatBreakdown(11.9, 19)).toMatchObject({
      gross: 11.9,
      net: 10,
      tax: 1.9,
      ust: 1.9,
    });
  });

  it("calculates order totals with gross line prices", () => {
    const drinkGross = 11.9;
    const foodGross = 10;

    const result = calculateOrderTaxFromItems([
      { lineTotal: drinkGross, taxRate: STANDARD_VAT_RATE },
      { lineTotal: foodGross, taxRate: REDUCED_VAT_RATE },
    ]);

    expect(result.total).toBe(21.9);
    expect(result.subtotal).toBeCloseTo(19.35, 2);
    expect(result.taxAmount).toBeCloseTo(2.55, 2);
    expect(result.subtotal + result.taxAmount).toBeCloseTo(result.total, 2);
  });

  it("groups mixed rates by gross buckets", () => {
    const groups = groupGrossByRate([
      { gross: 11.9, taxRate: 19 },
      { gross: 10, taxRate: 7 },
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.find((g) => g.rate === 19)?.gross).toBe(11.9);
    expect(groups.find((g) => g.rate === 7)?.gross).toBe(10);
  });
});
