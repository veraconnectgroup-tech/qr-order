import {
  buildStaffPushEnvelope,
  mapStaffNotificationToPushType,
  shouldThrottleTablePush,
  TABLE_THROTTLE_SEC,
} from "@/lib/push/push-intelligence";
import {
  buildStaffNotification,
  DEFAULT_NOTIFICATION_RULES,
  shouldDeliverStaffNotification,
  type NotificationRules,
  type StaffNotification,
  type StaffNotificationPriority,
  type StaffNotificationType,
} from "@/lib/denis/notifications/staff-notifications";
import { logger } from "@/lib/logger";
import { notifyLocationPush } from "@/lib/push/notify-location";
import { getRedisClient, logRedisDegradation } from "@/lib/redis/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { persistStaffNotification } from "@/lib/denis/notifications/persist-staff-notification";

export { TABLE_THROTTLE_SEC };

function throttleKey(locationId: string, tableId: string) {
  return `denis:staff-notify:${locationId}:${tableId}`;
}

function actionUrlForType(
  type: StaffNotificationType,
  tableId?: string
): string {
  switch (type) {
    case "allergy_alert":
      return "/kitchen";
    case "denis_escalation":
    case "high_value_order":
      return "/dashboard/denis";
    case "waiter_call":
    case "long_wait":
      return tableId ? `/waiter/tables/${tableId}` : "/waiter/calls";
    case "kitchen_backup":
      return "/kitchen";
    case "payment_issue":
      return "/dashboard/orders";
    case "table_transfer":
      return tableId ? `/waiter/tables/${tableId}` : "/waiter/tables";
    case "staff_training":
      return "/dashboard/staff";
    default:
      return "/dashboard";
  }
}

async function markTableNotification(
  locationId: string,
  tableId: string
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  try {
    await redis.set(throttleKey(locationId, tableId), String(Date.now()), {
      ex: TABLE_THROTTLE_SEC,
    });
  } catch (error) {
    logRedisDegradation("denis.staff-notify.throttle.set", error);
  }
}

async function lastTableNotificationAt(
  locationId: string,
  tableId: string
): Promise<number | null> {
  const redis = getRedisClient();
  if (!redis) return null;
  try {
    const raw = await redis.get(throttleKey(locationId, tableId));
    if (typeof raw === "string") {
      const ts = Number(raw);
      return Number.isFinite(ts) ? ts : null;
    }
  } catch (error) {
    logRedisDegradation("denis.staff-notify.throttle.read", error);
  }
  return null;
}

export async function dispatchStaffNotification(input: {
  orgId?: string;
  locationId: string;
  type: StaffNotificationType;
  message: string;
  tableId?: string;
  tableName?: string;
  actionUrl?: string;
  rules?: NotificationRules;
  recipientStaffId?: string;
  assignedWaiterId?: string | null;
  priorityOverride?: StaffNotificationPriority;
  playSound?: boolean;
}): Promise<{ delivered: boolean; notification: StaffNotification }> {
  const rules = input.rules ?? DEFAULT_NOTIFICATION_RULES;
  const notification = buildStaffNotification({
    type: input.type,
    message: input.message,
    tableId: input.tableId,
    tableName: input.tableName,
    actionUrl: input.actionUrl ?? actionUrlForType(input.type, input.tableId),
    priority: input.priorityOverride,
  });

  const lastAt =
    input.tableId != null
      ? await lastTableNotificationAt(input.locationId, input.tableId)
      : null;

  if (
    input.tableId &&
    shouldThrottleTablePush(lastAt) &&
    notification.priority !== "urgent" &&
    input.type !== "allergy_alert"
  ) {
    return { delivered: false, notification };
  }

  const shouldDeliver = shouldDeliverStaffNotification({
    rules,
    type: input.type,
    tableId: input.tableId,
    assignedWaiterId: input.assignedWaiterId,
    recipientStaffId: input.recipientStaffId ?? "broadcast",
    lastTableNotificationAt: lastAt,
  });

  if (!shouldDeliver) {
    return { delivered: false, notification };
  }

  const pushType = mapStaffNotificationToPushType(input.type);
  const envelope = buildStaffPushEnvelope({
    pushType,
    message: input.message,
    tableName: input.tableName,
    actionUrl: notification.actionUrl,
    priority: notification.priority,
    playSound: input.playSound,
  });

  const result = await notifyLocationPush(
    input.locationId,
    {
      title: envelope.title,
      body: envelope.body,
      url: envelope.url,
      sound: envelope.sound,
      urgent: envelope.urgent,
      type: envelope.type,
      soundProfile: envelope.soundProfile,
      vibrate: envelope.vibrate,
    },
    {
      assignedStaffId: input.assignedWaiterId,
      broadcast: envelope.broadcast,
    }
  );

  if (input.tableId) {
    await markTableNotification(input.locationId, input.tableId);
  }

  if (input.orgId) {
    try {
      const admin = createAdminClient();
      await persistStaffNotification(admin, {
        orgId: input.orgId,
        locationId: input.locationId,
        notification,
      });
    } catch (error) {
      logger.warn("Denis staff notification persist failed", {
        type: input.type,
        locationId: input.locationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info("Denis staff notification dispatched", {
    type: input.type,
    pushType: envelope.type,
    locationId: input.locationId,
    tableId: input.tableId,
    priority: notification.priority,
    broadcast: envelope.broadcast,
    pushSent: result.sent,
    targeted: result.targeted,
  });

  return { delivered: result.sent > 0, notification };
}

export function scheduleStaffNotification(
  input: Parameters<typeof dispatchStaffNotification>[0]
): void {
  void dispatchStaffNotification(input).catch((error) => {
    logger.warn("Denis staff notification failed", {
      type: input.type,
      locationId: input.locationId,
      error: error instanceof Error ? error.message : String(error),
    });
  });
}
