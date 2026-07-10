import type { StaffProactiveAlertKind } from "@/lib/denis/cognition/proactive/proactive-types";

export type StaffNotificationType =
  | "high_value_order"
  | "allergy_alert"
  | "long_wait"
  | "waiter_call"
  | "vip_guest"
  | "kitchen_backup"
  | "kitchen_prep_brief"
  | "denis_escalation"
  | "payment_issue"
  | "table_transfer"
  | "staff_training"
  | "inventory_running_low"
  | "inventory_will_run_out"
  | "inventory_just_ran_out"
  | "denis_relay";

export type StaffNotificationPriority = "low" | "medium" | "high" | "urgent";

export type StaffNotification = {
  type: StaffNotificationType;
  priority: StaffNotificationPriority;
  tableId?: string;
  tableName?: string;
  message: string;
  actionUrl?: string;
  createdAt: string;
};

export type NotificationRules = {
  highValueThreshold: number;
  longWaitMinutes: number;
  allergyAlert: boolean;
  kitchenBacklogThreshold: number;
  quietHours?: { start: string; end: string };
};

export const DEFAULT_NOTIFICATION_RULES: NotificationRules = {
  highValueThreshold: 100,
  longWaitMinutes: 15,
  allergyAlert: true,
  kitchenBacklogThreshold: 10,
};

function parseMinutes(value: string): number {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

export function isWithinQuietHours(
  rules: NotificationRules,
  now = new Date()
): boolean {
  if (!rules.quietHours) return false;
  const current = now.getHours() * 60 + now.getMinutes();
  const start = parseMinutes(rules.quietHours.start);
  const end = parseMinutes(rules.quietHours.end);
  if (start <= end) {
    return current >= start && current <= end;
  }
  return current >= start || current <= end;
}

const PRIORITY_BY_TYPE: Record<StaffNotificationType, StaffNotificationPriority> = {
  allergy_alert: "urgent",
  payment_issue: "urgent",
  staff_training: "high",
  denis_escalation: "high",
  kitchen_backup: "high",
  table_transfer: "high",
  inventory_will_run_out: "high",
  inventory_just_ran_out: "urgent",
  inventory_running_low: "medium",
  kitchen_prep_brief: "medium",
  long_wait: "medium",
  waiter_call: "medium",
  high_value_order: "medium",
  denis_relay: "medium",
  vip_guest: "low",
};

export function mapStaffProactiveAlertToNotificationType(
  kind: StaffProactiveAlertKind
): StaffNotificationType {
  switch (kind) {
    case "staff_allergy":
      return "allergy_alert";
    case "staff_waiter_request":
      return "waiter_call";
    case "staff_table_idle":
      return "long_wait";
    case "staff_attention_escalation":
    case "staff_frustrated_guest":
    case "staff_low_experience":
    case "staff_kitchen_delay":
    case "staff_multi_table_delay":
      return "denis_escalation";
    case "staff_preorder_heads_up":
      return "kitchen_prep_brief";
    default:
      return "denis_escalation";
  }
}

export function notificationPriority(
  type: StaffNotificationType
): StaffNotificationPriority {
  return PRIORITY_BY_TYPE[type];
}

export function shouldDeliverStaffNotification(input: {
  rules: NotificationRules;
  type: StaffNotificationType;
  tableId?: string;
  assignedWaiterId?: string | null;
  recipientStaffId: string;
  lastTableNotificationAt?: number | null;
  now?: number;
}): boolean {
  if (isWithinQuietHours(input.rules, new Date(input.now ?? Date.now()))) {
    return false;
  }

  if (
    input.assignedWaiterId &&
    input.recipientStaffId === input.assignedWaiterId &&
    input.type !== "allergy_alert" &&
    input.type !== "payment_issue"
  ) {
    return false;
  }

  const throttleMs = 5 * 60_000;
  if (
    input.tableId &&
    input.lastTableNotificationAt &&
    (input.now ?? Date.now()) - input.lastTableNotificationAt < throttleMs
  ) {
    return false;
  }

  if (input.type === "allergy_alert" && !input.rules.allergyAlert) {
    return false;
  }

  return true;
}

export function buildStaffNotification(input: {
  type: StaffNotificationType;
  tableId?: string;
  tableName?: string;
  message: string;
  actionUrl?: string;
  createdAt?: string;
  priority?: StaffNotificationPriority;
}): StaffNotification {
  return {
    type: input.type,
    priority: input.priority ?? notificationPriority(input.type),
    tableId: input.tableId,
    tableName: input.tableName,
    message: input.message,
    actionUrl: input.actionUrl,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}
