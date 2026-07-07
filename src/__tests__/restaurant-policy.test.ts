import { describe, expect, it } from "vitest";
import { DEFAULT_RESTAURANT_POLICY } from "@/lib/denis/policy/restaurant-policy-defaults";
import {
  evaluateRestaurantPolicy,
  recordRestaurantPolicyAlert,
  type PolicyTableState,
} from "@/lib/denis/policy/evaluate-restaurant-policy";
import type { RestaurantPolicy } from "@/lib/denis/policy/restaurant-policy.schema";

const NOW = new Date("2026-07-07T18:40:00.000Z");

function minutesAgo(minutes: number): string {
  return new Date(NOW.getTime() - minutes * 60_000).toISOString();
}

function servingOrderBrokenTable(): PolicyTableState {
  return {
    tableId: "table-8",
    tableName: "Table 8",
    orderId: "order-1",
    isVip: false,
    items: [
      {
        itemId: "item-food",
        itemName: "Burger",
        category: "food",
        orderedAt: minutesAgo(20),
        servedAt: minutesAgo(10),
        orderedEvent: { id: "evt-food-ordered", eventType: "item.ordered", createdAt: minutesAgo(20) },
        servedEvent: { id: "evt-food-served", eventType: "item.served", createdAt: minutesAgo(10) },
      },
      {
        itemId: "item-drink",
        itemName: "Beer",
        category: "drink",
        orderedAt: minutesAgo(20),
        servedAt: minutesAgo(7),
        orderedEvent: { id: "evt-drink-ordered", eventType: "item.ordered", createdAt: minutesAgo(20) },
        servedEvent: { id: "evt-drink-served", eventType: "item.served", createdAt: minutesAgo(7) },
      },
    ],
  };
}

function overdueDrinkTable(): PolicyTableState {
  return {
    tableId: "table-12",
    tableName: "Table 12",
    orderId: "order-2",
    isVip: false,
    items: [
      {
        itemId: "item-drink",
        itemName: "Cola",
        category: "drink",
        orderedAt: minutesAgo(7),
        servedAt: null,
        orderedEvent: { id: "evt-cola-ordered", eventType: "item.ordered", createdAt: minutesAgo(7) },
        servedEvent: null,
      },
    ],
  };
}

describe("evaluateRestaurantPolicy", () => {
  it("stays silent when the rule is disabled, even though it was violated", () => {
    const policy: RestaurantPolicy = {
      ...DEFAULT_RESTAURANT_POLICY,
      servingOrder: { drinksBeforeFood: true, notifyIfBroken: false },
    };

    const alerts = evaluateRestaurantPolicy({
      policy,
      now: NOW,
      tables: [servingOrderBrokenTable()],
    });

    expect(alerts).toHaveLength(0);
  });

  it("stays silent when max wait threshold is turned off (null)", () => {
    const policy: RestaurantPolicy = {
      ...DEFAULT_RESTAURANT_POLICY,
      maxWaitMinutes: { ...DEFAULT_RESTAURANT_POLICY.maxWaitMinutes, drinks: null },
    };

    const alerts = evaluateRestaurantPolicy({
      policy,
      now: NOW,
      tables: [overdueDrinkTable()],
    });

    expect(alerts).toHaveLength(0);
  });

  it("fires an Evidence-backed alert when the rule is enabled and violated", () => {
    const policy: RestaurantPolicy = {
      ...DEFAULT_RESTAURANT_POLICY,
      servingOrder: { drinksBeforeFood: true, notifyIfBroken: true },
    };

    const alerts = evaluateRestaurantPolicy({
      policy,
      now: NOW,
      tables: [servingOrderBrokenTable()],
    });

    expect(alerts).toHaveLength(1);
    const [alert] = alerts;
    expect(alert.ruleId).toBe("serving_order.drinks_before_food");
    expect(alert.tableId).toBe("table-8");
    expect(alert.evidence.length).toBeGreaterThanOrEqual(2);
    for (const evidence of alert.evidence) {
      expect(evidence.source).toBe("order_events");
      expect(evidence.orderId).toBe("order-1");
      expect(evidence.eventId).toBeTruthy();
    }
  });

  it("fires a max-wait alert with Evidence when threshold is exceeded", () => {
    const policy: RestaurantPolicy = {
      ...DEFAULT_RESTAURANT_POLICY,
      maxWaitMinutes: { ...DEFAULT_RESTAURANT_POLICY.maxWaitMinutes, drinks: 5 },
    };

    const alerts = evaluateRestaurantPolicy({
      policy,
      now: NOW,
      tables: [overdueDrinkTable()],
    });

    expect(alerts).toHaveLength(1);
    expect(alerts[0].ruleId).toBe("max_wait.drinks");
    expect(alerts[0].evidence[0].source).toBe("order_events");
    expect(alerts[0].evidence[0].eventId).toBe("evt-cola-ordered");
  });

  it("debounces the same rule+table within the window", () => {
    const policy: RestaurantPolicy = {
      ...DEFAULT_RESTAURANT_POLICY,
      maxWaitMinutes: { ...DEFAULT_RESTAURANT_POLICY.maxWaitMinutes, drinks: 5 },
    };

    const firstRun = evaluateRestaurantPolicy({
      policy,
      now: NOW,
      tables: [overdueDrinkTable()],
    });
    expect(firstRun).toHaveLength(1);

    const debounceState = recordRestaurantPolicyAlert({}, firstRun[0], NOW);

    const secondRun = evaluateRestaurantPolicy({
      policy,
      now: new Date(NOW.getTime() + 5 * 60_000),
      tables: [overdueDrinkTable()],
      debounceState,
    });
    expect(secondRun).toHaveLength(0);

    const thirdRun = evaluateRestaurantPolicy({
      policy,
      now: new Date(NOW.getTime() + 11 * 60_000),
      tables: [overdueDrinkTable()],
      debounceState,
    });
    expect(thirdRun).toHaveLength(1);
  });
});
