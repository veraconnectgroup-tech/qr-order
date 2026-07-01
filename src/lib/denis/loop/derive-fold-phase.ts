import {
  inferSessionPhaseFromCommerce,
  type SessionPhaseOrder,
} from "@/lib/denis/loop/infer-session-phase";
import type { OrderFact, SessionPhase } from "@/lib/denis/loop/types";
import { isPaidPaymentStatus } from "@/lib/orders/payment-status";

function ordersForPhaseInference(orders: OrderFact[]): SessionPhaseOrder[] {
  return orders.map((order) => ({
    status: order.status,
    createdAt: order.createdAt,
    deliveredAt: order.deliveredAt,
    items: order.items.map((item) => ({ menuSection: item.menuSection })),
  }));
}

export function deriveFoldSessionPhase(input: {
  sessionStatus: string;
  accessState: string | null;
  orders: OrderFact[];
  hasCartActivity: boolean;
  billSettled: boolean;
  nowMs?: number;
}): SessionPhase {
  return inferSessionPhaseFromCommerce({
    sessionClosed:
      input.sessionStatus !== "active" ||
      input.accessState === "closed" ||
      input.accessState === "closing",
    billSettled: input.billSettled,
    hasCartActivity: input.hasCartActivity,
    orders: ordersForPhaseInference(input.orders),
    nowMs: input.nowMs,
  });
}

export function sessionHasUnpaidOrders(orders: OrderFact[]): boolean {
  return orders.some((order) => !isPaidPaymentStatus(order.paymentStatus));
}
