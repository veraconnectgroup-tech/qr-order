import { describe, expect, it } from "vitest";
import {
  mergePeerCartIntoLocal,
  peerCartRevisionChanged,
} from "@/lib/guest/apply-peer-cart-snapshot";
import type { CartItem } from "@/hooks/use-cart";

function localItem(
  productId: string,
  productName: string,
  quantity: number,
  unitPrice: number
): CartItem {
  return {
    productId,
    productName,
    unitPrice,
    quantity,
    notes: "",
    modifiers: [],
    itemTotal: unitPrice * quantity,
  };
}

describe("party cart sync", () => {
  it("merges peer device cart into local shared_cart session", () => {
    const merged = mergePeerCartIntoLocal(
      [localItem("p-burger", "Burger", 1, 12)],
      [
        {
          deviceFingerprint: "device-a",
          snapshot: {
            revision: 1,
            updatedAt: new Date().toISOString(),
            itemCount: 1,
            subtotal: 12,
            hasFood: true,
            hasDrinks: false,
            items: [
              {
                productId: "p-burger",
                productName: "Burger",
                quantity: 1,
                serveSize: null,
                lineTotal: 12,
              },
            ],
          },
        },
        {
          deviceFingerprint: "device-b",
          snapshot: {
            revision: 2,
            updatedAt: new Date().toISOString(),
            itemCount: 1,
            subtotal: 4,
            hasFood: false,
            hasDrinks: true,
            items: [
              {
                productId: "p-pivo",
                productName: "Pivo",
                quantity: 1,
                serveSize: "0.5L",
                lineTotal: 4,
              },
            ],
          },
        },
      ],
      "device-a"
    );

    expect(merged.map((line) => line.productName).sort()).toEqual([
      "Burger",
      "Pivo",
    ]);
  });

  it("detects peer cart revision changes", () => {
    expect(peerCartRevisionChanged(null, 1)).toBe(false);
    expect(peerCartRevisionChanged(1, 1)).toBe(false);
    expect(peerCartRevisionChanged(1, 2)).toBe(true);
  });
});
