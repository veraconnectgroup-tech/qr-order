import { describe, expect, it } from "vitest";
import {
  autoUnavailableProductIds,
  classifyStockStatus,
  evaluateInventory,
  guestSubstitutionHint,
  inventoryAlertToStaffNotification,
  shouldSkipProactiveForUnavailableProduct,
} from "@/lib/denis/intelligence/inventory-awareness";
import { substituteFor } from "@/lib/denis/kernel/vkg/queries";
import { buildVenueKnowledgeGraph } from "@/lib/denis/kernel/vkg/build-graph";

function dessertGraph() {
  return buildVenueKnowledgeGraph({
    locationId: "loc-inv",
    categories: [{ id: "cat-dessert", name: "Deserti", menu_section: "desserts" }],
    products: [
      {
        id: "tiramisu",
        name: "Tiramisu",
        category_id: "cat-dessert",
        price: 8,
        is_available: true,
        allergens: [],
        ai_description: null,
        menu_section: "desserts",
      },
      {
        id: "panna",
        name: "Panna cotta",
        category_id: "cat-dessert",
        price: 7,
        is_available: true,
        allergens: [],
        ai_description: null,
        menu_section: "desserts",
      },
    ],
    upsellRules: [],
  });
}

describe("inventory awareness W3", () => {
  it("flags tiramisu as critical when stock is low vs daily average", () => {
    const todayOrderCounts = new Map([["tiramisu", 15]]);
    const historicalDailyAvg = new Map([["tiramisu", 12]]);

    const { levels, alerts } = evaluateInventory({
      products: [{ id: "tiramisu", name: "Tiramisu", currentStock: 3 }],
      todayOrderCounts,
      historicalDailyAvg,
      currentHour: 18,
      closingHour: 24,
    });

    expect(levels[0]?.status).toBe("critical");
    expect(alerts.some((alert) => alert.type === "will_run_out_today")).toBe(
      true
    );
  });

  it("stock=3 with daily avg 25 → running_low alert", () => {
    const { levels, alerts } = evaluateInventory({
      products: [{ id: "pilsner", name: "Pilsner", currentStock: 3 }],
      todayOrderCounts: new Map(),
      historicalDailyAvg: new Map([["pilsner", 25]]),
      currentHour: 18,
      closingHour: 24,
    });

    expect(levels[0]?.status).toBe("low");
    expect(alerts.some((alert) => alert.type === "running_low")).toBe(true);
    expect(alerts[0]?.suggestion.toLowerCase()).toContain("pilsner");
  });

  it("auto-unavailable only when stock is zero (auto-86)", () => {
    const { levels } = evaluateInventory({
      products: [
        { id: "a", name: "A", currentStock: 2 },
        { id: "b", name: "B", currentStock: 0 },
      ],
      todayOrderCounts: new Map(),
      historicalDailyAvg: new Map([
        ["a", 20],
        ["b", 20],
      ]),
      currentHour: 12,
      closingHour: 22,
    });

    expect(autoUnavailableProductIds(levels)).toEqual(["b"]);
  });

  it("stock=0 triggers substitute suggestion via VKG", () => {
    const graph = dessertGraph();
    const substitutes = substituteFor(graph, "tiramisu", {
      unavailableProductIds: ["tiramisu"],
    });
    expect(substitutes[0]?.name).toBe("Panna cotta");
    expect(guestSubstitutionHint("Tiramisu", substitutes[0]!.name)).toContain(
      "Panna cotta"
    );
  });

  it("maps inventory alerts to staff notification types", () => {
    const notification = inventoryAlertToStaffNotification({
      productId: "pilsner",
      productName: "Pilsner",
      type: "running_low",
      suggestion: "Naruči Pilsner za sutra.",
    });
    expect(notification.type).toBe("inventory_running_low");
    expect(notification.priority).toBe("medium");
  });

  it("skips proactive dessert nudge for unavailable product name", () => {
    expect(
      shouldSkipProactiveForUnavailableProduct({
        nudgeKind: "dessert_nudge",
        message: "Možda Tiramisu za kraj?",
        unavailableProductNames: ["Tiramisu"],
      })
    ).toBe(true);
    expect(
      shouldSkipProactiveForUnavailableProduct({
        nudgeKind: "order_ready",
        message: "Porudžbina je spremna.",
        unavailableProductNames: ["Tiramisu"],
      })
    ).toBe(false);
  });

  it("treats unknown stock as ok", () => {
    expect(classifyStockStatus(null, 25)).toBe("ok");
    const { levels } = evaluateInventory({
      products: [{ id: "x", name: "X", currentStock: null }],
      todayOrderCounts: new Map(),
      historicalDailyAvg: new Map(),
      currentHour: 12,
      closingHour: 22,
    });
    expect(levels[0]?.status).toBe("ok");
  });
});
