import {
  menuSectionToStation,
  prepTimeFactsFromDeliveredOrder,
} from "@/lib/denis/config/prep-time-priors";

export { menuSectionToStation };

export function collectPrepTimeFacts(
  order: {
    id?: string;
    status: string;
    created_at?: string | null;
    accepted_at?: string | null;
    preparing_at: string | null;
    delivered_at: string | null;
    order_items: Array<{
      product_id: string | null;
      product_name: string;
      menu_section: string | null;
    }> | null;
  },
  context: {
    locationId: string;
    timezone: string;
    isRush?: boolean;
  }
) {
  if (order.status !== "delivered") return [];
  return prepTimeFactsFromDeliveredOrder(order, context);
}

export type { PrepStation } from "@/lib/denis/config/prep-time-priors";
