import type { OrderItem, OrderWithDetails } from "@/types";

export const MENU_SECTIONS = ["drinks", "food", "desserts"] as const;
export type MenuSection = (typeof MENU_SECTIONS)[number];

/** Sections that appear on the kitchen / prep display. */
export const KITCHEN_MENU_SECTIONS: MenuSection[] = ["food", "desserts"];

export function isKitchenMenuSection(
  section: string | null | undefined
): section is MenuSection {
  return section === "food" || section === "desserts";
}

export function getKitchenOrderItems(
  order: Pick<OrderWithDetails, "order_items">
): OrderWithDetails["order_items"] {
  return (order.order_items ?? []).filter((item) =>
    isKitchenMenuSection(item.menu_section)
  );
}

export function orderHasKitchenItems(
  order: Pick<OrderWithDetails, "order_items">
): boolean {
  return getKitchenOrderItems(order).length > 0;
}

export function isDrinksOnlyOrder(
  order: Pick<OrderWithDetails, "order_items">
): boolean {
  const items = order.order_items ?? [];
  return (
    items.length > 0 &&
    items.every((item) => item.menu_section === "drinks")
  );
}

export type OrderItemWithSection = OrderItem & {
  menu_section?: MenuSection | null;
};
