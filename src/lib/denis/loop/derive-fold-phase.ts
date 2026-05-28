import { deriveSessionPhase } from "@/lib/scene/compose-scene";
import { isPaidPaymentStatus } from "@/lib/orders/payment-status";
import type { OrderFact, SessionPhase } from "@/lib/denis/loop/types";

const KITCHEN_OPEN_STATUSES = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
] as const;

function isKitchenOpenStatus(status: string): boolean {
  return (KITCHEN_OPEN_STATUSES as readonly string[]).includes(status);
}

export function deriveFoldSessionPhase(input: {
  sessionStatus: string;
  accessState: string | null;
  orders: OrderFact[];
  hasCartActivity: boolean;
  billSettled: boolean;
}): SessionPhase {
  const hasOpenKitchenOrders = input.orders.some((order) =>
    isKitchenOpenStatus(order.status)
  );
  const allOrdersDelivered =
    input.orders.length > 0 &&
    input.orders.every((order) => order.status === "delivered");

  return deriveSessionPhase({
    sessionClosed:
      input.sessionStatus !== "active" ||
      input.accessState === "closed" ||
      input.accessState === "closing",
    hasOpenKitchenOrders,
    hasCartActivity: input.hasCartActivity,
    billSettled: input.billSettled,
    allOrdersDelivered,
  });
}

export function sessionHasUnpaidOrders(orders: OrderFact[]): boolean {
  return orders.some((order) => !isPaidPaymentStatus(order.paymentStatus));
}
