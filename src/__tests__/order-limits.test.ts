import { describe, expect, it } from "vitest";
import {
  validateOrderItems,
  validateOrderTotal,
} from "@/lib/security/order-limits";

describe("validateOrderItems", () => {
  it("returns error for an empty order", () => {
    expect(validateOrderItems([])).toBe("Order is empty");
  });

  it("returns error when there are 101 items", () => {
    const items = Array.from({ length: 101 }, (_, i) => ({
      productId: `product-${i}`,
      quantity: 1,
    }));

    expect(validateOrderItems(items)).toMatch(/Too many items/);
  });

  it("returns error when quantity is 0", () => {
    expect(
      validateOrderItems([{ productId: "product-1", quantity: 0 }])
    ).not.toBeNull();
  });

  it("returns error when quantity is 100", () => {
    expect(
      validateOrderItems([{ productId: "product-1", quantity: 100 }])
    ).not.toBeNull();
  });

  it("allows quantity up to 99", () => {
    expect(
      validateOrderItems([{ productId: "product-1", quantity: 99 }])
    ).toBeNull();
  });

  it("returns null for a valid order", () => {
    expect(
      validateOrderItems([
        { productId: "product-1", quantity: 2 },
        { productId: "product-2", quantity: 5 },
      ])
    ).toBeNull();
  });
});

describe("validateOrderTotal", () => {
  it("returns error when total is 0", () => {
    expect(validateOrderTotal(0)).not.toBeNull();
  });

  it("returns error when total is 5001", () => {
    expect(validateOrderTotal(5001)).not.toBeNull();
  });

  it("returns null when total is 99.99", () => {
    expect(validateOrderTotal(99.99)).toBeNull();
  });
});
