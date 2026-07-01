import { describe, expect, it } from "vitest";
import type { OrderWithDetails } from "@/types";
import {
  classifyBarDrink,
  groupBarDrinkRounds,
  prioritizeBarQueue,
} from "@/lib/bar/bar-intelligence";

function drinkOrder(input: {
  id: string;
  tableId: string;
  tableName: string;
  productName: string;
  quantity?: number;
  status?: OrderWithDetails["status"];
  createdAt?: string;
}): OrderWithDetails {
  return {
    id: input.id,
    table_id: input.tableId,
    status: input.status ?? "pending",
    created_at: input.createdAt ?? new Date().toISOString(),
    order_items: [
      {
        id: `${input.id}-item`,
        order_id: input.id,
        product_id: null,
        product_name: input.productName,
        quantity: input.quantity ?? 1,
        unit_price: 4,
        total: 4,
        notes: null,
        menu_section: "drinks",
        tax_rate: 19,
        order_item_modifiers: [],
      },
    ],
    tables: { name: input.tableName },
  } as unknown as OrderWithDetails;
}

function foodOrder(input: {
  id: string;
  tableId: string;
  tableName: string;
  status?: OrderWithDetails["status"];
}): OrderWithDetails {
  return {
    id: input.id,
    table_id: input.tableId,
    status: input.status ?? "preparing",
    created_at: new Date().toISOString(),
    order_items: [
      {
        id: `${input.id}-item`,
        order_id: input.id,
        product_id: null,
        product_name: "Burger",
        quantity: 1,
        unit_price: 12,
        total: 12,
        notes: null,
        menu_section: "food",
        tax_rate: 19,
        order_item_modifiers: [],
      },
    ],
    tables: { name: input.tableName },
  } as unknown as OrderWithDetails;
}

describe("classifyBarDrink", () => {
  it("classifies instant beer and cocktail prep windows", () => {
    expect(classifyBarDrink("Pilsner 0.5L").kind).toBe("instant");
    expect(classifyBarDrink("Pilsner 0.5L").targetPrepMinutes).toBe(0);
    expect(classifyBarDrink("Negroni").kind).toBe("cocktail");
    expect(classifyBarDrink("Negroni").targetPrepMinutes).toBe(4);
    expect(classifyBarDrink("Espresso").kind).toBe("coffee");
    expect(classifyBarDrink("Espresso").targetPrepMinutes).toBe(2);
  });
});

describe("groupBarDrinkRounds", () => {
  it("groups 4x Pilsner for table 5 into one round", () => {
    const entries = prioritizeBarQueue(
      [
        drinkOrder({
          id: "d1",
          tableId: "t5",
          tableName: "5",
          productName: "Pilsner",
          quantity: 4,
        }),
      ],
      []
    );

    const rounds = groupBarDrinkRounds(entries);
    expect(rounds).toHaveLength(1);
    expect(rounds[0]?.summary).toBe("Sto 5: 4× Pilsner");
    expect(rounds[0]?.totalQuantity).toBe(4);
  });
});

describe("prioritizeBarQueue", () => {
  it("boosts drink priority when food is waiting at the same table", () => {
    const drink = drinkOrder({
      id: "drink-1",
      tableId: "t3",
      tableName: "3",
      productName: "Pilsner",
    });
    const cocktail = drinkOrder({
      id: "drink-2",
      tableId: "t9",
      tableName: "9",
      productName: "Negroni",
    });
    const food = foodOrder({
      id: "food-1",
      tableId: "t3",
      tableName: "3",
      status: "preparing",
    });

    const queue = prioritizeBarQueue([drink, cocktail], [drink, cocktail, food]);
    expect(queue[0]?.order.id).toBe("drink-1");
    expect(queue[0]?.foodWaitingBoost).toBe(true);
    expect(queue[0]?.priorityReasons[0]).toContain("food waiting");
  });
});
