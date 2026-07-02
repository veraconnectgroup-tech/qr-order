import type { StaffNotificationRow } from "@/lib/denis/notifications/persist-staff-notification";
import { isServiceRecoveryNotificationMessage } from "@/lib/denis/cognition/recovery/build-service-recovery-alert";
import { isBusTableEscalationMessage } from "@/lib/denis/cognition/waiter/bus-table-obligation";

export const DEFAULT_READY_STUCK_MINUTES = 2;

export type OperationsReadyStuckRow = {
  orderId: string;
  orderNumber: number | null;
  station: "kitchen" | "bar";
  readyAt: string;
  waitMinutes: number;
  tableId: string | null;
  tableName: string | null;
};

const BURNING_PRIORITIES = new Set(["urgent", "high"]);

export function filterBurningNotifications(
  notifications: StaffNotificationRow[]
): StaffNotificationRow[] {
  return notifications.filter(
    (row) =>
      !row.readAt &&
      BURNING_PRIORITIES.has(row.priority) &&
      !isServiceRecoveryNotificationMessage(row.message) &&
      !isBusTableEscalationMessage(row.message)
  );
}

/** ADR-043 S13 — overdue bus table escalations (2× SLA) in Ops Center. */
export function filterBusTableEscalationNotifications(
  notifications: StaffNotificationRow[]
): StaffNotificationRow[] {
  return notifications.filter(
    (row) => !row.readAt && isBusTableEscalationMessage(row.message)
  );
}

/** ADR-043 S12 — unread service recovery escalations (shown in dedicated Ops section). */
export function filterOpenServiceRecoveryNotifications(
  notifications: StaffNotificationRow[]
): StaffNotificationRow[] {
  return notifications.filter(
    (row) => !row.readAt && isServiceRecoveryNotificationMessage(row.message)
  );
}

export function filterRiskPriorityTables<
  T extends { priority: string; tableId: string },
>(tables: T[]): T[] {
  return tables.filter(
    (table) => table.priority === "urgent" || table.priority === "high"
  );
}

export function minutesSince(iso: string, nowMs: number): number {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return 0;
  return Math.max(0, Math.floor((nowMs - ts) / 60_000));
}

export function filterReadyStuckRows(
  rows: OperationsReadyStuckRow[],
  thresholdMinutes: number,
  nowMs: number = Date.now()
): OperationsReadyStuckRow[] {
  return rows
    .filter((row) => minutesSince(row.readyAt, nowMs) >= thresholdMinutes)
    .sort(
      (a, b) =>
        minutesSince(b.readyAt, nowMs) - minutesSince(a.readyAt, nowMs)
    );
}

export function secondsUntilExpiry(
  expiresAt: string,
  nowMs: number = Date.now()
): number {
  const ts = Date.parse(expiresAt);
  if (!Number.isFinite(ts)) return 0;
  return Math.max(0, Math.floor((ts - nowMs) / 1000));
}

export function formatExpiryCountdown(totalSeconds: number): string {
  if (totalSeconds <= 0) return "0s";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

export function stationSurfaceHref(station: "kitchen" | "bar"): string {
  return station === "kitchen" ? "/kitchen" : "/bar";
}

export function stationLabel(station: "kitchen" | "bar"): string {
  return station === "kitchen" ? "Kuhinja" : "Bar";
}
