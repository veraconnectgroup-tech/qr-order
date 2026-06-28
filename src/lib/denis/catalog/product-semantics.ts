import { isMenuSection, type MenuSection } from "@/lib/menu-section";
import type { KitchenPrepStation } from "@/lib/denis/venue/ops/kitchen-prep-stations";

export type ProductSemanticMeta = {
  menuSection?: string | null;
  foodTags?: string[];
  drinkFamily?: string | null;
  prepStation?: string | null;
};

export function resolveProductMenuSection(
  meta: ProductSemanticMeta
): MenuSection | null {
  if (meta.menuSection && isMenuSection(meta.menuSection)) {
    return meta.menuSection;
  }
  if (meta.foodTags?.includes("dessert")) return "desserts";
  if (meta.drinkFamily) return "drinks";
  return null;
}

export function isDessertProduct(meta: ProductSemanticMeta): boolean {
  if (meta.menuSection === "desserts") return true;
  return meta.foodTags?.includes("dessert") ?? false;
}

export function isDrinkProduct(meta: ProductSemanticMeta): boolean {
  if (meta.menuSection === "drinks") return true;
  return Boolean(meta.drinkFamily?.trim());
}

export function hasFoodTag(meta: ProductSemanticMeta, tag: string): boolean {
  return meta.foodTags?.includes(tag) ?? false;
}

export type VenueDrinkMixCategory = "beer" | "wine" | "cocktail" | "other";

/** Map DB drink_family → venue drink mix bucket. */
export function classifyDrinkMixCategory(
  drinkFamily: string | null | undefined
): VenueDrinkMixCategory {
  const family = drinkFamily?.trim().toLowerCase();
  if (!family) return "other";
  if (family === "beer") return "beer";
  if (family.startsWith("wine")) return "wine";
  if (family === "cocktail" || family === "spirit") return "cocktail";
  return "other";
}

export function resolvePrepStationFromProduct(
  meta: ProductSemanticMeta
): KitchenPrepStation {
  const station = meta.prepStation?.trim().toLowerCase();
  if (
    station === "grill" ||
    station === "fryer" ||
    station === "salad" ||
    station === "cold"
  ) {
    return station;
  }
  if (station === "bar") return "cold";
  if (meta.menuSection === "desserts" || meta.foodTags?.includes("dessert")) {
    return "pass";
  }
  if (meta.menuSection === "drinks" || meta.drinkFamily) return "cold";
  if (meta.foodTags?.includes("salad")) return "salad";
  if (
    meta.foodTags?.includes("fried") ||
    meta.foodTags?.includes("fries") ||
    meta.foodTags?.includes("side")
  ) {
    return "fryer";
  }
  if (
    meta.foodTags?.includes("grilled") ||
    meta.foodTags?.includes("steak") ||
    meta.foodTags?.includes("burger")
  ) {
    return "grill";
  }
  if (meta.menuSection === "food") return "grill";
  return "grill";
}
