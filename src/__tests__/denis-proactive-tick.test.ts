import { describe, expect, it } from "vitest";
import type { AiGuestOrder } from "@/lib/ai/order-context";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { evaluateGuestProactiveTick } from "@/lib/denis/runtime/evaluate-proactive-tick";

function order(partial: Partial<AiGuestOrder> & { id: string }): AiGuestOrder {
  return {
    id: partial.id,
    status: partial.status ?? "pending",
    created_at: partial.created_at ?? new Date().toISOString(),
    delivered_at: partial.delivered_at ?? null,
    order_items: partial.order_items ?? [
      {
        product_name: "Burger",
        quantity: 1,
        menu_section: "food",
      },
    ],
  } as AiGuestOrder;
}

describe("proactive tick M11", () => {
  it("returns browse nudge when guest browses without ordering", () => {
    const result = evaluateGuestProactiveTick({
      config: CONCIERGE_PLATFORM_DEFAULTS,
      orders: [],
      payload: {
        browseMinutes: 5,
        cartItemCount: 0,
        hasSessionOrders: false,
      },
      messages: {
        browse: "Need help choosing?",
        dessert: "Dessert?",
        slowKitchen: "Slow kitchen",
      },
    });

    expect(result?.kind).toBe("browse_nudge");
    expect(result?.message).toBe("Need help choosing?");
  });

  it("respects dismissed nudge keys", () => {
    const now = Date.now();
    const result = evaluateGuestProactiveTick({
      config: CONCIERGE_PLATFORM_DEFAULTS,
      orders: [
        order({
          id: "o1",
          created_at: new Date(now - 60_000).toISOString(),
        }),
      ],
      payload: {
        cartItemCount: 0,
        hasSessionOrders: true,
        hasDrinkInCart: false,
        dismissedNudgeKeys: ["drink_pairing:o1"],
      },
      messages: {
        browse: "Browse",
        dessert: "Dessert",
        slowKitchen: "Slow",
      },
      now,
    });

    expect(result).toBeNull();
  });
});
