/** Drink Sommelier — taxonomy nodes for VKG-backed pairing (L2 bar intelligence). */

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

const BEER_PATTERN =
  /\b(pilsner|lager|weizen|radler|pivo|beer|ipa|stout|ale|porter)\b/i;
const WINE_RED_PATTERN =
  /\b(cabernet|merlot|shiraz|syrah|malbec|tempranillo|crveno|red wine|vino crno)\b/i;
const WINE_WHITE_PATTERN =
  /\b(riesling|sauvignon|chardonnay|pinot grigio|belo|white wine|vino belo|prosecco|šampanjac|champagne)\b/i;
const COCKTAIL_PATTERN =
  /\b(cocktail|spritz|aperol|negroni|mojito|margarita|martini|gin tonic|g&t|aperitif)\b/i;
const SPIRIT_PATTERN =
  /\b(whisky|whiskey|rum|gin|vodka|rakija|grappa|digestif|liker|liqueur)\b/i;
const COFFEE_PATTERN =
  /\b(espresso|latte|cappuccino|kafa|coffee|macchiato)\b/i;
const NON_ALCO_PATTERN =
  /\b(cola|sprite|sok|juice|water|voda|limunada|lemonade|mocktail|bezalkohol)\b/i;

/** Non-alcoholic alternatives for common alcoholic families. */
export const MOCKTAIL_MAP: Record<string, string> = {
  pilsner: "Radler 0%",
  lager: "Radler 0%",
  beer: "Bezalkoholno pivo",
  pivo: "Bezalkoholno pivo",
  wine: "Grapefruit mocktail",
  vino: "Grapefruit mocktail",
  spritz: "Aperol Spritz 0%",
  aperol: "Aperol Spritz 0%",
  cocktail: "Virgin mojito",
  negroni: "Sanbitter spritz",
};

export function classifyDrinkKnowledge(productName: string): DrinkKnowledgeNode {
  const name = productName.trim();

  if (COFFEE_PATTERN.test(name)) {
    return {
      category: "coffee",
      family: "Coffee",
      pairsWith: ["dessert"],
    };
  }

  if (NON_ALCO_PATTERN.test(name)) {
    return {
      category: "non_alcoholic",
      family: "Soft drink",
      pairsWith: ["salty", "spicy", "general"],
    };
  }

  if (WINE_RED_PATTERN.test(name)) {
    return {
      category: "wine",
      family: "Red wine",
      style: "Full-bodied",
      pairsWith: ["steak", "beef", "grilled", "rich"],
    };
  }

  if (WINE_WHITE_PATTERN.test(name)) {
    const semiDry = /riesling|pinot grigio/i.test(name);
    return {
      category: "wine",
      family: semiDry ? "White, Semi-dry" : "White wine",
      style: semiDry ? "Semi-dry" : "Dry",
      pairsWith: ["fish", "salad", "asian", "light"],
    };
  }

  if (COCKTAIL_PATTERN.test(name)) {
    const aperitif = /spritz|aperol|aperitif|negroni/i.test(name);
    return {
      category: "cocktail",
      family: aperitif ? "Aperitif" : "Cocktail",
      pairsWith: aperitif ? ["before_meal", "salty"] : ["general"],
      mocktailAlternative: mocktailFor(name) ?? undefined,
    };
  }

  if (SPIRIT_PATTERN.test(name)) {
    return {
      category: "spirit",
      family: "Digestif",
      pairsWith: ["after_meal", "dessert"],
    };
  }

  if (BEER_PATTERN.test(name)) {
    const light = /pilsner|lager|radler/i.test(name);
    return {
      category: "beer",
      family: light ? "Light Lager" : "Beer",
      pairsWith: ["salty", "steak", "burger", "grilled"],
      mocktailAlternative: mocktailFor(name) ?? undefined,
    };
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
    if (lower.includes(key)) return alt;
  }
  return null;
}

const STEAK_PATTERN =
  /\b(steak|ribeye|beef|teletina|svinjetina|burger|pljeskav|ćevap|cevap|grill|roštilj)\b/i;
const SALAD_PATTERN = /\b(salat|salad|salata|cezar|caesar|zelena)\b/i;
const FISH_PATTERN = /\b(fish|riba|losos|salmon|tuna|brancin|orada|školjke)\b/i;
const ASIAN_PATTERN =
  /\b(sushi|suši|ramen|wok|azij|asian|curry|pad thai|dim sum)\b/i;

/** Derive food pairing tags from a dish name. */
export function foodTagsFromProductName(foodName: string): string[] {
  const tags: string[] = [];
  const name = foodName.trim();
  if (STEAK_PATTERN.test(name)) tags.push("steak", "beef", "grilled");
  if (SALAD_PATTERN.test(name)) tags.push("salad", "light");
  if (FISH_PATTERN.test(name)) tags.push("fish");
  if (ASIAN_PATTERN.test(name)) tags.push("asian");
  if (tags.length === 0) tags.push("general");
  return tags;
}

export function formatDrinkNodeLine(node: DrinkKnowledgeNode, productName: string): string {
  return `${productName} → ${node.family}${node.style ? ` (${node.style})` : ""} → pairs: ${node.pairsWith.join(", ")}`;
}
