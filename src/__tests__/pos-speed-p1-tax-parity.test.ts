import { describe, expect, it } from "vitest";
import {
  computeStaffOrderTotals,
  computeStaffOrderTotalsFromServerItems,
} from "@/lib/tax/compute-staff-order-totals";
import { REDUCED_VAT_RATE, STANDARD_VAT_RATE } from "@/lib/tax/vat";

const DRINK_PRODUCT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const FOOD_PRODUCT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("POS Speed P1 — client/server tax parity", () => {
  it("matches server-style item totals for mixed VAT cart", () => {
    const orgDefaultRate = 19;
    const isTakeaway = false;

    const clientItems = [
      {
        productId: DRINK_PRODUCT_ID,
        quantity: 2,
        unitPrice: 4.5,
        productTaxRate: REDUCED_VAT_RATE,
        menuSection: "drinks" as const,
        modifiers: [{ modifierId: "mod-1", price: 0.5 }],
      },
      {
        productId: FOOD_PRODUCT_ID,
        quantity: 1,
        unitPrice: 12,
        productTaxRate: null,
        menuSection: "food" as const,
        modifiers: [],
      },
    ];

    const clientTotals = computeStaffOrderTotals({
      cartItems: clientItems,
      isTakeaway,
      orgDefaultRate,
    });

    const serverTotals = computeStaffOrderTotalsFromServerItems({
      items: clientItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        productTaxRate: item.productTaxRate,
        menuSection: item.menuSection,
        modifiers: item.modifiers.map((mod) => ({ price: mod.price })),
      })),
      isTakeaway,
      orgDefaultRate,
    });

    expect(clientTotals).toEqual(serverTotals);
    expect(clientTotals.total).toBe(22);
    expect(clientTotals.items).toHaveLength(2);
    expect(clientTotals.items[0]?.taxRate).toBe(STANDARD_VAT_RATE);
    expect(clientTotals.items[1]?.taxRate).toBe(STANDARD_VAT_RATE);
  });

  it("applies reduced VAT for takeaway food with tax_rate=7", () => {
    const result = computeStaffOrderTotals({
      cartItems: [
        {
          productId: FOOD_PRODUCT_ID,
          quantity: 1,
          unitPrice: 10,
          productTaxRate: REDUCED_VAT_RATE,
          menuSection: "food",
          modifiers: [],
        },
      ],
      isTakeaway: true,
      orgDefaultRate: 19,
    });

    expect(result.items[0]?.taxRate).toBe(REDUCED_VAT_RATE);
    expect(result.total).toBe(10);
    expect(result.subtotal + result.taxAmount).toBeCloseTo(result.total, 2);
  });
});
