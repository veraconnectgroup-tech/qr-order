export type GuestOrderStatus =
  | "pending_approval"
  | "pending"
  | "accepted"
  | "preparing"
  | "ready"
  | "delivered"
  | "rejected"
  | "cancelled";

const STATUS_I18N_KEY: Record<string, string> = {
  pending_approval: "ai.order.status.pendingApproval",
  pending: "ai.order.status.pending",
  accepted: "ai.order.status.accepted",
  preparing: "ai.order.status.preparing",
  ready: "ai.order.status.ready",
  delivered: "ai.order.status.delivered",
};

export function aiOrderStatusMessageKey(status: string): string | null {
  return STATUS_I18N_KEY[status] ?? null;
}

export function isTerminalOrderStatus(status: string) {
  return status === "delivered" || status === "rejected" || status === "cancelled";
}

export function shouldNotifyStatusChange(
  previous: string | undefined,
  next: string
) {
  if (!previous || previous === next) return false;
  if (isTerminalOrderStatus(previous) && isTerminalOrderStatus(next)) {
    return false;
  }
  return aiOrderStatusMessageKey(next) != null;
}
