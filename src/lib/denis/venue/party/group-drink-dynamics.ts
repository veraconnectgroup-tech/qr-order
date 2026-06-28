import type { AiGuestOrder } from "@/lib/ai/order-context";

export type PartyDrinkGapFacts = {
  partySize: number;
  devicesWithDrink: number;
  missingCount: number;
};

function isBarDrinkOrder(order: AiGuestOrder): boolean {
  return order.order_items.some((item) => item.menu_section === "drinks");
}

function isActiveOrderStatus(status: string): boolean {
  return ["pending", "accepted", "preparing", "ready", "delivered"].includes(
    status
  );
}

/** Count drink orders this session (proxy for party members with drinks). */
export function countDevicesWithDrinkOrders(orders: AiGuestOrder[]): number {
  return orders.filter(
    (order) => isActiveOrderStatus(order.status) && isBarDrinkOrder(order)
  ).length;
}

export function derivePartyDrinkGapFacts(input: {
  partySize: number;
  orders: AiGuestOrder[];
}): PartyDrinkGapFacts | null {
  if (input.partySize < 2) return null;

  const devicesWithDrink = countDevicesWithDrinkOrders(input.orders);
  if (devicesWithDrink <= 0) return null;
  if (devicesWithDrink >= input.partySize) return null;

  return {
    partySize: input.partySize,
    devicesWithDrink,
    missingCount: input.partySize - devicesWithDrink,
  };
}

/** Party of 4 with 3 drinks — ask the missing guest once (not nagging). */
export function detectPartyDrinkGap(input: {
  partySize: number;
  orders: AiGuestOrder[];
  hasDrinkInCart?: boolean;
  isShown: () => boolean;
}): PartyDrinkGapFacts | null {
  if (input.isShown()) return null;
  if (input.hasDrinkInCart) return null;

  const facts = derivePartyDrinkGapFacts({
    partySize: input.partySize,
    orders: input.orders,
  });
  if (!facts) return null;

  // Exactly one missing guest — gentle single invite
  if (facts.missingCount !== 1) return null;
  if (facts.devicesWithDrink < input.partySize - 1) return null;

  return facts;
}
