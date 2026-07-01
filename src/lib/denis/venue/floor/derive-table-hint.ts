import type { FloorTableHint } from "@/lib/denis/venue/floor/types";

export const FLOOR_HINT_THRESHOLDS = {
  needsAttentionIdleMinutes: 15,
  dessertAfterDeliveryMinutes: 10,
  idleSeatedMinutes: 20,
} as const;

type TableOrderSnapshot = {
  status: string;
  created_at: string;
  delivered_at?: string | null;
  hasKitchenItems: boolean;
  hasDessert: boolean;
};

function minutesSince(iso: string, nowMs: number): number {
  return (nowMs - new Date(iso).getTime()) / 60_000;
}

/** Lightweight per-table hint for staff copilot (M14). */
export function deriveTableOperatingHint(input: {
  sessionOpenedAt: string | null;
  orders: TableOrderSnapshot[];
  lastGuestActivityAt: string | null;
  backlogThresholdMinutes: number;
  nowMs?: number;
}): FloorTableHint {
  void input.backlogThresholdMinutes;
  const now = input.nowMs ?? Date.now();

  if (!input.sessionOpenedAt) return null;

  const lastActivity = input.lastGuestActivityAt ?? input.sessionOpenedAt;
  const minutesSinceActivity = minutesSince(lastActivity, now);
  const seatedMinutes = minutesSince(input.sessionOpenedAt, now);
  const hasAnyOrder = input.orders.length > 0;

  if (
    minutesSinceActivity >= FLOOR_HINT_THRESHOLDS.needsAttentionIdleMinutes
  ) {
    return "needs_attention";
  }

  const hasDessert = input.orders.some((order) => order.hasDessert);
  const deliveredFoodAt = input.orders
    .filter(
      (order) =>
        order.status === "delivered" &&
        order.hasKitchenItems &&
        !order.hasDessert
    )
    .map((order) => order.delivered_at ?? order.created_at)
    .sort()
    .pop();

  if (
    deliveredFoodAt &&
    !hasDessert &&
    minutesSince(deliveredFoodAt, now) >=
      FLOOR_HINT_THRESHOLDS.dessertAfterDeliveryMinutes
  ) {
    return "ready_for_dessert";
  }

  if (!hasAnyOrder && seatedMinutes >= FLOOR_HINT_THRESHOLDS.idleSeatedMinutes) {
    return "idle";
  }

  return null;
}

export function countTablesWithHint(
  tables: Array<{ operatingHint: FloorTableHint }>,
  hint: Exclude<FloorTableHint, null>
): number {
  return tables.filter((table) => table.operatingHint === hint).length;
}

export function deriveHouseUnderstaffedHint(input: {
  staffOnFloor?: number | null;
  activeOrderCount?: number | null;
}): string | null {
  const staff = input.staffOnFloor ?? 0;
  const active = input.activeOrderCount ?? 0;
  if (staff <= 0 && active > 0) return "No staff currently assigned to floor.";
  if (staff > 0 && active / staff >= 7) return "Floor appears understaffed.";
  return null;
}
