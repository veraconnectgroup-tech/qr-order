import { describe, expect, it } from "vitest";
import {
  MAX_ITEMS_PER_ORDER,
  MAX_ORDER_AMOUNT,
  MAX_QUANTITY_PER_ITEM,
  validateOrderItems,
  validateOrderTotal,
} from "@/lib/security/order-limits";

describe("validateOrderItems", () => {
  it("returns error for an empty order", () => {
    expect(validateOrderItems([])).toBe("Order is empty");
  });

  it("returns error when there are too many items", () => {
    const items = Array.from({ length: MAX_ITEMS_PER_ORDER + 1 }, (_, i) => ({
      productId: `product-${i}`,
      quantity: 1,
    }));

    expect(validateOrderItems(items)).toBe("Too many items in order");
  });

  it("returns error when quantity exceeds 20", () => {
    expect(
      validateOrderItems([
        { productId: "product-1", quantity: MAX_QUANTITY_PER_ITEM + 1 },
      ])
    ).toBe("Invalid quantity for item");
  });
});

describe("validateOrderTotal", () => {
  it("returns error when total exceeds 5000", () => {
    expect(validateOrderTotal(MAX_ORDER_AMOUNT + 1)).toBe(
      "Order amount exceeds limit"
    );
  });
});
