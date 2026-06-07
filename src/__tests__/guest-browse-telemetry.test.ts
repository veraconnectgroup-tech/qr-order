import { describe, expect, it } from "vitest";
import { buildBrowseEvent } from "@/lib/guest/build-browse-event";

describe("buildBrowseEvent", () => {
  it("builds view_product with category path and menu section", () => {
    const event = buildBrowseEvent({
      action: "view_product",
      productId: "11111111-1111-4111-8111-111111111111",
      productName: "Beef Burger",
      categoryId: "cat-burgers",
      categoryLabel: "Burgers",
      menuSection: "food",
      dwellMs: 8200,
      now: new Date("2026-06-07T12:00:01.000Z"),
    });

    expect(event).toEqual({
      action: "view_product",
      productId: "11111111-1111-4111-8111-111111111111",
      productName: "Beef Burger",
      categoryId: "cat-burgers",
      categoryPath: ["food", "Burgers"],
      menuSection: "food",
      dwellMs: 8200,
      timestamp: "2026-06-07T12:00:01.000Z",
    });
  });

  it("builds cart mutations without dwell", () => {
    const event = buildBrowseEvent({
      action: "remove_from_cart",
      productId: "22222222-2222-4222-8222-222222222222",
      productName: "Pilsner",
      categoryId: "cat-beer",
      categoryLabel: "Beer",
      menuSection: "drinks",
    });

    expect(event.action).toBe("remove_from_cart");
    expect(event.menuSection).toBe("drinks");
    expect(event.dwellMs).toBeUndefined();
    expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
