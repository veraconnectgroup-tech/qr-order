import type { BrowseEvent, BrowseMenuSection } from "@/lib/denis/cognition/browse/browse-types";

const FOOD_SEGMENTS = [
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
] as const;

const DRINK_SEGMENTS = [
  "drinks",
  "drink",
  "beer",
  "wine",
  "cocktails",
  "spirits",
  "soft_drinks",
  "coffee",
  "tea",
] as const;

const DESSERT_SEGMENTS = [
  "desserts",
  "dessert",
  "sweets",
  "cakes",
  "ice_cream",
] as const;

function segmentMatches(
  segments: readonly string[],
  key: string
): boolean {
  return segments.includes(key);
}

/** Classify browse domain from catalog section or category path segments. */
export function classifyBrowseDomain(
  event: Pick<BrowseEvent, "menuSection" | "categoryPath">
): BrowseMenuSection | null {
  if (event.menuSection) return event.menuSection;

  const path = event.categoryPath ?? [];
  for (const segment of path) {
    const key = segment.toLowerCase().replace(/\s+/g, "_");
    if (segmentMatches(FOOD_SEGMENTS, key)) return "food";
    if (segmentMatches(DRINK_SEGMENTS, key)) return "drinks";
    if (segmentMatches(DESSERT_SEGMENTS, key)) return "desserts";
  }

  return null;
}

/** Human label from category path — last segment, title case. */
export function resolveCategoryLabel(
  categoryPath: string[] | undefined,
  fallback = "meni"
): string {
  const raw = categoryPath?.[categoryPath.length - 1]?.trim();
  if (!raw) return fallback;
  return raw.replace(/_/g, " ");
}

/** Popular-item hint for category browse nudge copy. */
export function categoryPopularPick(
  categoryLabel: string,
  menuSection: BrowseMenuSection | null
): string {
  const label = categoryLabel.toLowerCase();
  if (label.includes("salad") || label.includes("salat")) {
    return "Caesar salata";
  }
  if (menuSection === "desserts" || label.includes("desert")) {
    return "Tiramisu";
  }
  if (label.includes("burger")) return "Classic Burger";
  if (label.includes("pizza")) return "Margherita";
  return categoryLabel;
}
