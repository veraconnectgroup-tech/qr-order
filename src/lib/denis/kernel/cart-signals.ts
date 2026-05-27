/** Cart shape for flow/goal derivation — no legacy draft import. */
export type CartLineSnapshot = {
  menuSection?: string | null;
};

export type CartSnapshot = {
  itemCount: number;
  hasFood: boolean;
  hasDrinks: boolean;
  drinksOnly: boolean;
};

const FOOD_SECTIONS = [
  "food",
  "appetizer",
  "main",
  "dessert",
  "breakfast",
  "lunch",
  "dinner",
] as const;

export function analyzeCartSnapshot(
  items: CartLineSnapshot[]
): CartSnapshot {
  if (items.length === 0) {
    return {
      itemCount: 0,
      hasFood: false,
      hasDrinks: false,
      drinksOnly: false,
    };
  }

  let hasFood = false;
  let hasDrinks = false;

  for (const item of items) {
    const section = (item.menuSection ?? "").toLowerCase();
    if (section === "drinks" || section === "bar") {
      hasDrinks = true;
    }
    if ((FOOD_SECTIONS as readonly string[]).includes(section)) {
      hasFood = true;
    } else if (section && section !== "drinks" && section !== "bar") {
      hasFood = true;
    }
  }

  return {
    itemCount: items.length,
    hasFood,
    hasDrinks,
    drinksOnly: hasDrinks && !hasFood,
  };
}
