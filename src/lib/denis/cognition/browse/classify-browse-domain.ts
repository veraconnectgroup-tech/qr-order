import type { BrowseEvent, BrowseMenuSection } from "@/lib/denis/cognition/browse/browse-types";

const FOOD_SEGMENTS = new Set([
  "food",
  "burgers",
  "burger",
  "pizza",
  "steak",
  "salads",
  "salad",
  "appetizers",
  "mains",
  "sides",
  "snacks",
]);

const DRINK_SEGMENTS = new Set([
  "drinks",
  "drink",
  "beer",
  "wine",
  "cocktails",
  "spirits",
  "soft_drinks",
  "coffee",
  "tea",
]);

const DESSERT_SEGMENTS = new Set([
  "desserts",
  "dessert",
  "sweets",
  "cakes",
  "ice_cream",
]);

/** Classify browse domain from catalog section or category path segments. */
export function classifyBrowseDomain(
  event: Pick<BrowseEvent, "menuSection" | "categoryPath">
): BrowseMenuSection | null {
  if (event.menuSection) return event.menuSection;

  const path = event.categoryPath ?? [];
  for (const segment of path) {
    const key = segment.toLowerCase().replace(/\s+/g, "_");
    if (FOOD_SEGMENTS.has(key)) return "food";
    if (DRINK_SEGMENTS.has(key)) return "drinks";
    if (DESSERT_SEGMENTS.has(key)) return "desserts";
  }

  return null;
}
