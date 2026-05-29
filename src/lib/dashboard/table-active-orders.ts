import { isPaidPaymentStatus } from "@/lib/orders/payment-status";

const OPEN_ORDER_STATUSES = new Set([
  "pending",
  "pending_approval",
  "accepted",
  "preparing",
  "ready",
]);

type TableOrderRow = {
  payment_status: string;
  status: string;
  session_id: string | null;
  payment_requested_at?: string | null;
  payment_method?: string;
};

export function isUnpaidTableOrder(order: Pick<TableOrderRow, "payment_status">) {
  return !isPaidPaymentStatus(order.payment_status);
}

/** Orders that keep a table off the floor plan (service or open bill). */
export function isActiveTableOrder(
  order: TableOrderRow,
  session: { id: string } | null
): boolean {
  if (!isUnpaidTableOrder(order)) return false;

  if (session) {
    return order.session_id === session.id;
  }

  return OPEN_ORDER_STATUSES.has(order.status);
}

export function orderHasPaymentRequest(
  order: Pick<
    TableOrderRow,
    "payment_status" | "payment_requested_at" | "payment_method"
  >
): boolean {
  return (
    isUnpaidTableOrder(order) &&
    order.payment_requested_at != null &&
    order.payment_method !== "unset"
  );
}
