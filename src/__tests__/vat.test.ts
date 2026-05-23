import { describe, expect, it } from "vitest";
import {
  REDUCED_VAT_RATE,
  STANDARD_VAT_RATE,
  calculateOrderTaxFromItems,
  itemTaxAmount,
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

describe("calculateOrderTaxFromItems", () => {
  it("calculates tax_amount for mixed items", () => {
    const drinkLine = 10;
    const foodLine = 20;
    const drinkTax = itemTaxAmount(drinkLine, STANDARD_VAT_RATE);
    const foodTax = itemTaxAmount(foodLine, REDUCED_VAT_RATE);

    const result = calculateOrderTaxFromItems([
      { lineTotal: drinkLine, taxRate: STANDARD_VAT_RATE },
      { lineTotal: foodLine, taxRate: REDUCED_VAT_RATE },
    ]);

    expect(result.subtotal).toBe(30);
    expect(result.taxAmount).toBeCloseTo(drinkTax + foodTax);
    expect(result.total).toBeCloseTo(result.subtotal + result.taxAmount);
    expect(result.breakdown).toEqual(
      expect.arrayContaining([
        { rate: STANDARD_VAT_RATE, amount: drinkTax },
        { rate: REDUCED_VAT_RATE, amount: foodTax },
      ])
    );
  });
});
