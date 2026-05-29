import { describe, expect, it } from "vitest";
import { groupOrderItemsForDisplay } from "@/lib/orders/group-order-items-for-display";

const baseItem = {
  product_id: "prod-mojito",
  product_name: "Mojito",
  quantity: 1,
  unit_price: 3.5,
  total: 3.5,
  notes: null,
  menu_section: "drinks" as const,
  tax_rate: 19,
  order_item_modifiers: [] as Array<{
    id: string;
    order_item_id: string;
    modifier_id: string | null;
    modifier_name: string;
    price: number;
  }>,
};

describe("groupOrderItemsForDisplay", () => {
  it("sums duplicate product lines into one row", () => {
    const lines = groupOrderItemsForDisplay([
      { ...baseItem, id: "a", order_id: "o1" },
      { ...baseItem, id: "b", order_id: "o1" },
      { ...baseItem, id: "c", order_id: "o1" },
    ]);

    expect(lines).toHaveLength(1);
    expect(lines[0]?.quantity).toBe(3);
    expect(lines[0]?.product_name).toBe("Mojito");
  });

  it("keeps lines with different notes or modifiers separate", () => {
    const lines = groupOrderItemsForDisplay([
      { ...baseItem, id: "a", order_id: "o1", notes: "extra lime" },
      { ...baseItem, id: "b", order_id: "o1", notes: null },
      {
        ...baseItem,
        id: "c",
        order_id: "o1",
        order_item_modifiers: [
          {
            id: "m1",
            order_item_id: "c",
            modifier_id: "mod-1",
            modifier_name: "Double shot",
            price: 1,
          },
        ],
      },
    ]);

    expect(lines).toHaveLength(3);
    expect(lines.find((l) => l.notes === "extra lime")?.quantity).toBe(1);
    expect(lines.find((l) => l.notes === null && l.modifiers.length === 0)?.quantity).toBe(1);
  });
});
