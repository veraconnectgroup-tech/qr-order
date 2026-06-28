import { describe, expect, it } from "vitest";
import {
  parseMenuFromLlmJson,
  parseMenuFromOcrText,
} from "@/lib/menu-import/extract-menu-ocr";
import { parseMenuCsv } from "@/lib/menu-import/parse-menu-csv";
import { inferMenuSection } from "@/lib/menu-import/normalize-category";

const DEFAULT_CATEGORIES = [
  { id: "food-id", name: "Food", menu_section: "food" },
  { id: "drinks-id", name: "Drinks", menu_section: "drinks" },
  { id: "desserts-id", name: "Desserts", menu_section: "desserts" },
];

describe("parseMenuCsv", () => {
  it("imports 20 items with correct categories", () => {
    const rows = [
      "name,description,price,category,allergens",
      ...Array.from({ length: 8 }, (_, index) =>
        [
          `Burger ${index + 1}`,
          "House burger",
          `${9.5 + index}`,
          "Food",
          "gluten",
        ].join(",")
      ),
      ...Array.from({ length: 8 }, (_, index) =>
        [`Lager ${index + 1}`, "", `${4 + index}`, "Drinks", ""].join(",")
      ),
      ...Array.from({ length: 4 }, (_, index) =>
        [`Cake ${index + 1}`, "", `${5 + index}`, "Desserts", "milk"].join(",")
      ),
    ];

    const parsed = parseMenuCsv(rows.join("\n"), DEFAULT_CATEGORIES);

    expect(parsed.items).toHaveLength(20);
    expect(parsed.items.filter((item) => item.category === "Food")).toHaveLength(8);
    expect(parsed.items.filter((item) => item.category === "Drinks")).toHaveLength(8);
    expect(parsed.items.filter((item) => item.category === "Desserts")).toHaveLength(4);
    expect(parsed.categoriesUsed).toEqual(
      expect.arrayContaining(["food", "drinks", "desserts"])
    );
  });
});

describe("parseMenuFromOcrText", () => {
  it("extracts items from photo OCR text", () => {
    const text = `
Vorspeisen
Bruschetta 8.50 (gluten)
Getränke
Pilsner 4.90
Hauswein 6.50
Desserts
Tiramisu 7.20 (milk, eggs)
`;

    const parsed = parseMenuFromOcrText(text, DEFAULT_CATEGORIES);

    expect(parsed.items.length).toBeGreaterThanOrEqual(4);
    expect(parsed.items.find((item) => item.name === "Bruschetta")?.price).toBe(8.5);
    expect(parsed.items.find((item) => item.name === "Pilsner")?.category).toBe(
      "Drinks"
    );
    expect(
      parsed.items.find((item) => item.name === "Bruschetta")?.allergens
    ).toContain("gluten");
  });
});

describe("parseMenuFromLlmJson", () => {
  it("parses structured LLM menu payload", () => {
    const parsed = parseMenuFromLlmJson(
      JSON.stringify({
        items: [
          {
            name: "Margherita",
            description: "Tomato, mozzarella",
            price: 11.5,
            category: "Food",
            allergens: ["gluten", "milk"],
          },
        ],
      }),
      DEFAULT_CATEGORIES
    );

    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]?.name).toBe("Margherita");
    expect(parsed.items[0]?.price).toBe(11.5);
  });
});

describe("inferMenuSection", () => {
  it("maps localized category labels to menu sections", () => {
    expect(inferMenuSection("Getränke")).toBe("drinks");
    expect(inferMenuSection("Nachspeisen")).toBe("desserts");
    expect(inferMenuSection("Hauptgerichte")).toBe("food");
  });
});
