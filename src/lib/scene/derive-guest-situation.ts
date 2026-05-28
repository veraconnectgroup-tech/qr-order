/** Pure guest situation from live orders — SC-8 situation projection. */

export type GuestSituationOrder = {
  orderId: string;
  orderNumber: number;
  status: string;
  itemsLabel: string;
  prepMinutes: number | null;
};

export type GuestSituation = {
  headline: string;
  orders: GuestSituationOrder[];
  hasReadyOrder: boolean;
  hasActiveKitchen: boolean;
};

type SituationOrderRow = {
  id: string;
  order_number: number | null;
  status: string;
  estimated_prep_minutes: number | null;
  order_items: Array<{ product_name: string; quantity: number }> | null;
};

const KITCHEN_ACTIVE = new Set(["pending", "confirmed", "preparing"]);
const KITCHEN_READY = new Set(["ready"]);

function formatItemsLabel(
  items: Array<{ product_name: string; quantity: number }>
): string {
  if (!items.length) return "";
  const [first, ...rest] = items;
  const lead = `${first.quantity > 1 ? `${first.quantity}× ` : ""}${first.product_name}`;
  if (!rest.length) return lead;
  return `${lead} +${rest.length}`;
}

function statusHeadline(order: GuestSituationOrder): string {
  const prefix =
    order.orderNumber > 0 ? `#${order.orderNumber}` : order.itemsLabel;

  switch (order.status) {
    case "ready":
      return `${prefix} · ready — bringing to your table`;
    case "preparing":
      return order.prepMinutes
        ? `${order.itemsLabel} · preparing · ~${order.prepMinutes} min`
        : `${order.itemsLabel} · preparing`;
    case "confirmed":
    case "accepted":
      return `${order.itemsLabel} · accepted by kitchen`;
    case "pending":
      return `${order.itemsLabel} · received`;
    case "delivered":
      return `${order.itemsLabel} · served`;
    default:
      return `${order.itemsLabel} · ${order.status}`;
  }
}

/** Pick the most urgent line for collapsed dock + ordered list for expanded view. */
export function deriveGuestSituation(
  orders: SituationOrderRow[]
): GuestSituation | null {
  if (!orders.length) return null;

  const mapped: GuestSituationOrder[] = orders
    .filter((o) => o.status !== "delivered" && o.status !== "cancelled")
    .map((order) => ({
      orderId: order.id,
      orderNumber: order.order_number ?? 0,
      status: order.status,
      itemsLabel: formatItemsLabel(order.order_items ?? []),
      prepMinutes: order.estimated_prep_minutes,
    }))
    .filter((o) => o.itemsLabel.length > 0);

  if (!mapped.length) {
    const lastDelivered = [...orders]
      .reverse()
      .find((o) => o.status === "delivered");
    if (!lastDelivered) return null;
    const delivered: GuestSituationOrder = {
      orderId: lastDelivered.id,
      orderNumber: lastDelivered.order_number ?? 0,
      status: "delivered",
      itemsLabel: formatItemsLabel(lastDelivered.order_items ?? []),
      prepMinutes: null,
    };
    return {
      headline: statusHeadline(delivered),
      orders: [delivered],
      hasReadyOrder: false,
      hasActiveKitchen: false,
    };
  }

  const priority = (status: string) => {
    if (KITCHEN_READY.has(status)) return 0;
    if (status === "preparing") return 1;
    if (status === "confirmed" || status === "accepted") return 2;
    return 3;
  };

  const sorted = [...mapped].sort(
    (a, b) => priority(a.status) - priority(b.status)
  );

  return {
    headline: statusHeadline(sorted[0]!),
    orders: sorted,
    hasReadyOrder: sorted.some((o) => KITCHEN_READY.has(o.status)),
    hasActiveKitchen: sorted.some((o) => KITCHEN_ACTIVE.has(o.status)),
  };
}

export function situationSupportChips(): Array<{
  id: string;
  labelKey: string;
}> {
  return [
    { id: "situation-wrong", labelKey: "scene.situation.chipWrong" },
    { id: "situation-waiter", labelKey: "scene.situation.chipWaiter" },
  ];
}
