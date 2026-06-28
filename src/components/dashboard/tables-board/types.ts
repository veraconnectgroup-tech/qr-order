import type { Order, Table, TableSession, Zone } from "@/types";

export type TableOrder = Pick<
  Order,
  | "id"
  | "order_number"
  | "total"
  | "status"
  | "payment_requested_at"
  | "payment_status"
  | "payment_method"
>;

export type TableRow = Table & {
  zone: Zone | null;
  session: Pick<TableSession, "id" | "opened_at"> | null;
  activeOrders: TableOrder[];
  sessionTotal: number;
  hasWaiterCall: boolean;
  hasPaymentRequest: boolean;
};

export function formatDuration(since: string) {
  const ms = Date.now() - new Date(since).getTime();
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function orderStatusLabel(status: string) {
  switch (status) {
    case "delivered":
      return "Delivered ✓";
    case "preparing":
    case "accepted":
      return "Preparing ⟳";
    case "ready":
      return "Ready";
    case "rejected":
      return "Rejected";
    default:
      return "New";
  }
}

export function startOfTodayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
