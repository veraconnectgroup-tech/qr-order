import { describe, expect, it } from "vitest";
import { deriveGuestSituation } from "@/lib/scene/derive-guest-situation";

describe("deriveGuestSituation", () => {
  it("prioritizes ready orders in headline", () => {
    const situation = deriveGuestSituation([
      {
        id: "o1",
        order_number: 12,
        status: "preparing",
        payment_status: "pending",
        estimated_prep_minutes: 15,
        order_items: [{ product_name: "Caesar Salad", quantity: 1 }],
      },
      {
        id: "o2",
        order_number: 13,
        status: "ready",
        payment_status: "pending",
        estimated_prep_minutes: null,
        order_items: [{ product_name: "Burger", quantity: 1 }],
      },
    ]);

    expect(situation?.hasReadyOrder).toBe(true);
    expect(situation?.headline).toContain("ready");
    expect(situation?.orders).toHaveLength(2);
    expect(situation?.orders[0]?.primaryAction.kind).toBe("open_order");
  });

  it("returns null when no active orders", () => {
    expect(deriveGuestSituation([])).toBeNull();
  });
});
