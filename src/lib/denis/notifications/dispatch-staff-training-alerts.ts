import type { TrainingInsight } from "@/lib/admin/staff-training-insights";
import { dispatchStaffNotification } from "@/lib/denis/notifications/dispatch-staff-notification";
import {
  buildStaffNotification,
  DEFAULT_NOTIFICATION_RULES,
  type NotificationRules,
  type StaffNotificationPriority,
} from "@/lib/denis/notifications/staff-notifications";
import { logger } from "@/lib/logger";

/** Dispatch owner/manager alerts for critical staff training signals. */
export async function dispatchStaffTrainingAlerts(input: {
  orgId: string;
  locationId: string;
  insights: TrainingInsight[];
  rules?: NotificationRules;
}): Promise<{ dispatched: number; skipped: number }> {
  const actionable = input.insights.filter(
    (row) => row.severity === "critical" || row.severity === "action_needed"
  );

  if (actionable.length === 0) {
    return { dispatched: 0, skipped: 0 };
  }

  let dispatched = 0;
  let skipped = 0;

  for (const insight of actionable.slice(0, 3)) {
    const priority: StaffNotificationPriority =
      insight.severity === "critical" ? "urgent" : "high";

    const notification = buildStaffNotification({
      type: "staff_training",
      message: `${insight.area.toUpperCase()}: ${insight.title}`,
      actionUrl: "/dashboard/staff",
      priority,
    });

    try {
      const result = await dispatchStaffNotification({
        orgId: input.orgId,
        locationId: input.locationId,
        type: "staff_training",
        message: notification.message,
        actionUrl: notification.actionUrl,
        rules: input.rules ?? DEFAULT_NOTIFICATION_RULES,
        priorityOverride: priority,
        playSound: insight.severity === "critical",
      });

      if (result.delivered) {
        dispatched += 1;
      } else {
        skipped += 1;
      }
    } catch (error) {
      skipped += 1;
      logger.warn("staff training alert dispatch failed", {
        locationId: input.locationId,
        area: insight.area,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { dispatched, skipped };
}

export function scheduleStaffTrainingAlerts(
  input: Parameters<typeof dispatchStaffTrainingAlerts>[0]
): void {
  void dispatchStaffTrainingAlerts(input).catch((error) => {
    logger.warn("staff training alert schedule failed", {
      locationId: input.locationId,
      error: error instanceof Error ? error.message : String(error),
    });
  });
}
