import type { MenuCategoryHint } from "@/lib/menu-import/types";

const SECTION_ALIASES: Record<string, string> = {
  food: "food",
  essen: "food",
  main: "food",
  mains: "food",
  "main course": "food",
  hauptgerichte: "food",
  vorspeisen: "food",
  appetizer: "food",
  appetizers: "food",
  drinks: "drinks",
  drink: "drinks",
  beverage: "drinks",
  beverages: "drinks",
  getränke: "drinks",
  getraenke: "drinks",
  bar: "drinks",
  cocktail: "drinks",
  cocktails: "drinks",
  wine: "drinks",
  beer: "drinks",
  desserts: "desserts",
  dessert: "desserts",
  nachspeisen: "desserts",
  süßes: "desserts",
  susse: "desserts",
};

export function normalizeCategoryKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function inferMenuSection(categoryLabel: string): string {
  const key = normalizeCategoryKey(categoryLabel);
  if (SECTION_ALIASES[key]) return SECTION_ALIASES[key];
  for (const [alias, section] of Object.entries(SECTION_ALIASES)) {
    if (key.includes(alias)) return section;
  }
  if (/dessert|kuchen|cake|ice/i.test(categoryLabel)) return "desserts";
  if (/drink|wine|beer|cocktail|kaffee|coffee|tea|juice|saft/i.test(categoryLabel)) {
    return "drinks";
  }
  return "food";
}

export function resolveCategoryId(
  categoryLabel: string,
  categories: MenuCategoryHint[]
): string | null {
  const key = normalizeCategoryKey(categoryLabel);
  const byName = categories.find(
    (cat) =>
      normalizeCategoryKey(cat.name) === key ||
      normalizeCategoryKey(cat.menu_section) === key
  );
  if (byName) return byName.id;

  const section = inferMenuSection(categoryLabel);
  const bySection = categories.find((cat) => cat.menu_section === section);
  return bySection?.id ?? categories[0]?.id ?? null;
}

export function resolveCategoryLabel(
  categoryLabel: string,
  categories: MenuCategoryHint[]
): string {
  const key = normalizeCategoryKey(categoryLabel);
  const byName = categories.find(
    (cat) => normalizeCategoryKey(cat.name) === key
  );
  if (byName) return byName.name;

  const section = inferMenuSection(categoryLabel);
  const bySection = categories.find((cat) => cat.menu_section === section);
  return bySection?.name ?? (categoryLabel.trim() || "Food");
}
