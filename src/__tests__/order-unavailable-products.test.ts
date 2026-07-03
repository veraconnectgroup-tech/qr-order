import { describe, expect, it } from "vitest";
import { resolveUnavailableProductNames } from "@/lib/orders/create/pipeline/validate-cart";

describe("order unavailable product names", () => {
  it("uses the cart product name when the product row disappeared", () => {
    const names = resolveUnavailableProductNames({
      productIds: ["missing-product"],
      products: [],
      items: [
        {
          productId: "missing-product",
          productName: "Aperol Spritz",
          unitPrice: 9.5,
          quantity: 1,
          notes: "",
          modifiers: [],
          itemTotal: 9.5,
        },
      ],
    });

    expect(names).toEqual(["Aperol Spritz"]);
    expect(names).not.toContain("Unknown product");
  });

  it("uses the current catalog name when the product is unavailable", () => {
    const names = resolveUnavailableProductNames({
      productIds: ["aperol"],
      products: [
        {
          id: "aperol",
          name: "Aperol Spritz",
          price: 9.5,
          is_available: false,
          location_id: "loc_1",
          category_id: "cat_1",
          tax_rate: null,
        },
      ] as never,
      items: [
        {
          productId: "aperol",
          productName: "Old cart label",
          unitPrice: 9.5,
          quantity: 1,
          notes: "",
          modifiers: [],
          itemTotal: 9.5,
        },
      ],
    });

    expect(names).toEqual(["Aperol Spritz"]);
  });
});
