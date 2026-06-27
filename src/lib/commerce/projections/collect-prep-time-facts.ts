import {
  isBarMenuSection,
  isDessertMenuSection,
  isFoodMenuSection,
} from "@/lib/kitchen/menu-section";
import { localSlotFromDate } from "@/lib/denis/config/resolve-rhythm-priors";
import type { PrepStation } from "@/lib/denis/config/prep-time-priors";

export type PrepTimeFact = {
  locationId: string;
  productId: string;
  productName: string;
  menuSection: string | null;
  station: PrepStation;
  prepMinutes: number;
  dayOfWeek: number;
  hour: number;
  isRush: boolean;
};

export type PrepTimeOrderRow = {
  id: string;
  status: string;
  created_at: string;
  accepted_at: string | null;
  preparing_at: string | null;
  delivered_at: string | null;
  order_items: Array<{
    product_id: string | null;
    product_name: string;
    menu_section: string | null;
  }> | null;
};

export function menuSectionToStation(
  section: string | null | undefined
): PrepStation {
  if (isBarMenuSection(section)) return "bar";
  if (isDessertMenuSection(section)) return "dessert";
  if (isFoodMenuSection(section)) return "kitchen";
  return "kitchen";
}

function prepMinutesForOrder(order: PrepTimeOrderRow): number | null {
  if (order.status !== "delivered" || !order.delivered_at) {
    return null;
  }

  const deliveredAtMs = new Date(order.delivered_at).getTime();
  const startAt = order.preparing_at ?? order.accepted_at;
  if (!startAt) return null;

  const startMs = new Date(startAt).getTime();
  if (!Number.isFinite(deliveredAtMs) || !Number.isFinite(startMs)) {
    return null;
  }

  return Math.max(0, Math.round((deliveredAtMs - startMs) / 60_000));
}

/** Collect per-item prep time facts from a delivered order (VRP-P0 / A2). */
export function collectPrepTimeFacts(
  order: PrepTimeOrderRow,
  input: {
    locationId: string;
    timezone: string;
    isRush?: boolean;
  }
): PrepTimeFact[] {
  const prepMinutes = prepMinutesForOrder(order);
  if (prepMinutes == null) return [];

  const { dow, hour } = localSlotFromDate(
    new Date(order.delivered_at!),
    input.timezone
  );

  const facts: PrepTimeFact[] = [];
  for (const item of order.order_items ?? []) {
    const productName = item.product_name?.trim();
    if (!productName) continue;

    const productId = item.product_id ?? productName;
    facts.push({
      locationId: input.locationId,
      productId,
      productName,
      menuSection: item.menu_section,
      station: menuSectionToStation(item.menu_section),
      prepMinutes,
      dayOfWeek: dow,
      hour,
      isRush: input.isRush ?? false,
    });
  }

  return facts;
}
