/** Drink Sommelier — taxonomy nodes for VKG-backed pairing (L2 bar intelligence). */

import type { MenuSection } from "@/lib/menu-section";

export type DrinkCategory =
  | "beer"
  | "wine"
  | "cocktail"
  | "spirit"
  | "non_alcoholic"
  | "coffee";

export type DrinkOccasion = "aperitif" | "pairing" | "digestif" | "refill";

export type DrinkKnowledgeNode = {
  category: DrinkCategory;
  /** e.g. Light Lager, White Semi-dry, Aperitif */
  family: string;
  style?: string;
  /** Food tags this drink pairs with */
  pairsWith: string[];
  mocktailAlternative?: string;
};

export type DrinkKnowledgeInput = {
  productName?: string;
  drinkFamily?: string | null;
  tags?: string[];
  foodTags?: string[];
  menuSection?: MenuSection | string | null;
};

/** Non-alcoholic alternatives for common alcoholic families. */
export const MOCKTAIL_MAP: Record<string, string> = {
  beer: "Bezalkoholno pivo",
  pilsner: "Radler 0%",
  lager: "Radler 0%",
  wine_red: "Grapefruit mocktail",
  wine_white: "Grapefruit mocktail",
  wine: "Grapefruit mocktail",
  spritz: "Aperol Spritz 0%",
  cocktail: "Virgin mojito",
  negroni: "Sanbitter spritz",
};

const DRINK_FAMILY_NODES: Record<string, DrinkKnowledgeNode> = {
  beer: {
    category: "beer",
    family: "Light Lager",
    pairsWith: ["salty", "steak", "burger", "grilled"],
    mocktailAlternative: MOCKTAIL_MAP.beer,
  },
  wine_red: {
    category: "wine",
    family: "Red wine",
    style: "Full-bodied",
    pairsWith: ["steak", "beef", "grilled", "rich"],
    mocktailAlternative: MOCKTAIL_MAP.wine_red,
  },
  wine_white: {
    category: "wine",
    family: "White wine",
    style: "Dry",
    pairsWith: ["fish", "salad", "asian", "light"],
    mocktailAlternative: MOCKTAIL_MAP.wine_white,
  },
  cocktail: {
    category: "cocktail",
    family: "Cocktail",
    pairsWith: ["general", "salty"],
    mocktailAlternative: MOCKTAIL_MAP.cocktail,
  },
  spirit: {
    category: "spirit",
    family: "Digestif",
    pairsWith: ["after_meal", "dessert"],
  },
  coffee: {
    category: "coffee",
    family: "Coffee",
    pairsWith: ["dessert"],
  },
  non_alcoholic: {
    category: "non_alcoholic",
    family: "Soft drink",
    pairsWith: ["salty", "spicy", "general"],
  },
};

function nodeFromTags(tags: string[]): DrinkKnowledgeNode | null {
  for (const tag of tags) {
    const key = tag.trim().toLowerCase().replace(/\s+/g, "_");
    const node = DRINK_FAMILY_NODES[key];
    if (node) return { ...node };
  }
  return null;
}

function resolveDrinkKnowledgeInput(
  input: DrinkKnowledgeInput | string
): DrinkKnowledgeInput {
  return typeof input === "string" ? { productName: input } : input;
}

/** Classify drink from product metadata — no name-regex heuristics. */
export function classifyDrinkKnowledge(
  input: DrinkKnowledgeInput | string
): DrinkKnowledgeNode {
  const resolved = resolveDrinkKnowledgeInput(input);
  const familyKey = resolved.drinkFamily?.trim().toLowerCase() ?? "";
  if (familyKey && DRINK_FAMILY_NODES[familyKey]) {
    return { ...DRINK_FAMILY_NODES[familyKey]! };
  }

  const tagNode = nodeFromTags([
    ...(resolved.tags ?? []),
    ...(resolved.foodTags ?? []),
  ]);
  if (tagNode) return tagNode;

  if (resolved.menuSection === "drinks") {
    return { ...DRINK_FAMILY_NODES.beer! };
  }

  return {
    category: "non_alcoholic",
    family: "Beverage",
    pairsWith: ["general"],
  };
}

export function mocktailFor(productName: string): string | null {
  const lower = productName.trim().toLowerCase();
  for (const [key, alt] of Object.entries(MOCKTAIL_MAP)) {
    if (lower.includes(key.replace(/_/g, " ")) || lower.includes(key)) {
      return alt;
    }
  }
  return null;
}

/** Known product-name → tag map when DB food_tags not yet populated (not guest regex). */
const DEFAULT_PRODUCT_FOOD_TAGS: Record<string, string[]> = {
  steak: ["steak", "beef", "grilled"],
  burger: ["steak", "beef", "grilled"],
  pizza: ["pizza", "italian"],
  pasta: ["pasta", "italian"],
  salad: ["salad", "light"],
  "ceasar salata": ["salad", "light"],
  fish: ["fish"],
  salmon: ["fish"],
};

/** Derive food pairing tags from catalog metadata. */
export function foodTagsFromProduct(input: {
  foodName?: string;
  foodTags?: string[];
}): string[] {
  const fromDb = (input.foodTags ?? [])
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
  if (fromDb.length > 0) return fromDb;

  const key = input.foodName?.trim().toLowerCase();
  if (key && DEFAULT_PRODUCT_FOOD_TAGS[key]) {
    return DEFAULT_PRODUCT_FOOD_TAGS[key]!;
  }

  return ["general"];
}

/** @deprecated Use foodTagsFromProduct with catalog foodTags. */
export function foodTagsFromProductName(foodName: string): string[] {
  return foodTagsFromProduct({ foodName });
}

export function formatDrinkNodeLine(node: DrinkKnowledgeNode, productName: string): string {
  return `${productName} → ${node.family}${node.style ? ` (${node.style})` : ""} → pairs: ${node.pairsWith.join(", ")}`;
}
