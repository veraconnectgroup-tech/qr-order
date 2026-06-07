import type { BrowseEvent, BrowseMenuSection } from "@/lib/denis/cognition/browse/browse-types";
import type { MenuSection } from "@/lib/menu-section";

function toBrowseMenuSection(section: MenuSection | null | undefined): BrowseMenuSection | null {
  if (section === "food" || section === "drinks" || section === "desserts") {
    return section;
  }
  return null;
}

/** Build a Denis browse telemetry event (guest → signal ingress). */
export function buildBrowseEvent(input: {
  action: BrowseEvent["action"];
  productId?: string;
  productName?: string;
  categoryId?: string;
  categoryLabel?: string;
  menuSection?: MenuSection | null;
  dwellMs?: number;
  now?: Date;
}): BrowseEvent {
  const menuSection = toBrowseMenuSection(input.menuSection);
  const categoryPath =
    input.categoryLabel != null && input.categoryLabel.trim()
      ? [menuSection ?? "food", input.categoryLabel.trim()]
      : undefined;

  return {
    action: input.action,
    productId: input.productId,
    productName: input.productName?.trim() || undefined,
    categoryId: input.categoryId?.trim() || undefined,
    categoryPath,
    menuSection,
    dwellMs: input.dwellMs,
    timestamp: (input.now ?? new Date()).toISOString(),
  };
}
