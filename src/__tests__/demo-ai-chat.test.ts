import { describe, expect, it } from "vitest";
import type { MenuCategory } from "@/components/guest/menu-grid";
import { getDemoAiChatResponse } from "@/lib/demo-ai";

const menuCategories = [
  {
    id: "drinks",
    name: "Drinks",
    menu_section: "drinks",
    products: [
      {
        id: "aperol",
        name: "Aperol Spritz",
        price: 9.5,
        image_url: null,
        is_available: true,
        prep_time_minutes: 5,
        tags: [],
        modifier_groups: [],
      },
      {
        id: "negroni",
        name: "Negroni",
        price: 12,
        image_url: null,
        is_available: true,
        prep_time_minutes: 5,
        tags: [],
        modifier_groups: [],
      },
    ],
  },
  {
    id: "food",
    name: "Food",
    menu_section: "food",
    products: [
      {
        id: "fries",
        name: "Truffle Fries",
        price: 7,
        image_url: null,
        is_available: true,
        prep_time_minutes: 8,
        tags: ["vegetarian"],
        modifier_groups: [],
      },
    ],
  },
] as unknown as MenuCategory[];

describe("demo AI chat", () => {
  it("answers a pure greeting without pushing products", () => {
    const result = getDemoAiChatResponse("zdravo denise", menuCategories);

    expect(result.messageKey).toBe("ai.chat.greeting");
    expect(result.recommendations).toEqual([]);
  });

  it("still recommends drinks when the guest asks for a drink", () => {
    const result = getDemoAiChatResponse("preporuci mi neko pice", menuCategories);

    expect(result.messageKey).toBe("ai.demo.drinkReply");
    expect(result.recommendations.map((row) => row.name)).toEqual([
      "Aperol Spritz",
      "Negroni",
    ]);
  });
});
