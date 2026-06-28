import type { StaffNotificationType } from "@/lib/denis/notifications/staff-notifications";

/** Staff push types (Web Push envelope). */
export type PushNotifyType =
  | "new-order"
  | "waiter-call"
  | "order-ready"
  | "payment-request"
  | "staff-alert"
  | "staff-allergy"
  | "staff-urgent"
  | "waitlist-ready";

/** Guest push types. */
export type GuestPushType =
  | "guest-order-ready"
  | "guest-waitlist-ready"
  | "guest-denis-message";

export type PushSoundProfile = "ding" | "ring" | "alarm" | "default";

export const TABLE_THROTTLE_SEC = 300;
export const PUSH_GROUP_WINDOW_SEC = 60;

const URGENT_STAFF_TYPES = new Set<PushNotifyType>([
  "waiter-call",
  "staff-allergy",
  "staff-urgent",
  "waitlist-ready",
]);

const GROUPABLE_STAFF_TYPES = new Set<PushNotifyType>(["new-order"]);

export function mapStaffNotificationToPushType(
  type: StaffNotificationType
): PushNotifyType {
  switch (type) {
    case "allergy_alert":
      return "staff-allergy";
    case "payment_issue":
      return "payment-request";
    case "waiter_call":
      return "waiter-call";
    case "kitchen_backup":
    case "kitchen_prep_brief":
      return "order-ready";
    case "denis_escalation":
    case "long_wait":
    case "inventory_running_low":
    case "inventory_will_run_out":
    case "inventory_just_ran_out":
    case "staff_training":
    case "table_transfer":
      return "staff-alert";
    case "high_value_order":
    case "vip_guest":
    default:
      return "staff-alert";
  }
}

export function resolvePushSoundProfile(
  type: PushNotifyType | GuestPushType
): PushSoundProfile {
  switch (type) {
    case "new-order":
      return "ding";
    case "waiter-call":
    case "waitlist-ready":
      return "ring";
    case "staff-allergy":
    case "staff-urgent":
      return "alarm";
    case "guest-order-ready":
      return "ding";
    case "guest-waitlist-ready":
      return "ring";
    case "guest-denis-message":
      return "default";
    default:
      return "default";
  }
}

export function resolvePushVibrate(
  type: PushNotifyType | GuestPushType
): number[] | undefined {
  const profile = resolvePushSoundProfile(type);
  if (profile === "alarm") return [200, 100, 200, 100, 400];
  if (profile === "ring") return [120, 60, 120, 60, 120];
  if (profile === "ding") return [80, 40, 80];
  return undefined;
}

export function isUrgentPushType(type: PushNotifyType | GuestPushType): boolean {
  if (URGENT_STAFF_TYPES.has(type as PushNotifyType)) return true;
  return type === "guest-waitlist-ready";
}

export function shouldBroadcastPushToAllStaff(input: {
  type: PushNotifyType;
  urgent?: boolean;
  priority?: "low" | "medium" | "high" | "urgent";
}): boolean {
  if (input.urgent || input.priority === "urgent") return true;
  if (isUrgentPushType(input.type)) return true;
  if (input.type === "staff-allergy" || input.type === "staff-urgent") return true;
  return false;
}

export function shouldGroupPushType(type: PushNotifyType): boolean {
  return GROUPABLE_STAFF_TYPES.has(type);
}

export function formatGroupedPushMessage(
  type: PushNotifyType,
  count: number,
  singularBody: string
): { title: string; body: string } {
  if (type === "new-order" && count > 1) {
    return {
      title: "Novi orderi",
      body: `${count} nova ordera`,
    };
  }
  return { title: "Obavijest", body: singularBody };
}

export function shouldThrottleTablePush(
  lastTableNotificationAt: number | null | undefined,
  now = Date.now()
): boolean {
  if (!lastTableNotificationAt) return false;
  return now - lastTableNotificationAt < TABLE_THROTTLE_SEC * 1000;
}

export function buildGuestOrderReadyPush(input: {
  orderNumber: number;
  language?: string;
}): { title: string; body: string } {
  const lang = (input.language ?? "sr").slice(0, 2);
  if (lang === "en") {
    return {
      title: "Your order is ready!",
      body: `Order #${input.orderNumber} is ready — we're on our way.`,
    };
  }
  if (lang === "de") {
    return {
      title: "Ihre Bestellung ist fertig!",
      body: `Bestellung #${input.orderNumber} ist fertig.`,
    };
  }
  return {
    title: "Vaša narudžbina je gotova!",
    body: `Porudžbina #${input.orderNumber} je spremna — nosimo je.`,
  };
}

export function buildGuestDenisMessagePush(input: {
  preview: string;
  language?: string;
}): { title: string; body: string } {
  const lang = (input.language ?? "sr").slice(0, 2);
  const preview = input.preview.trim().slice(0, 120);
  if (lang === "en") {
    return {
      title: "Message from Denis",
      body: preview || "You have an unread message from Denis.",
    };
  }
  return {
    title: "Poruka od Denisa",
    body: preview || "Imate nepročitanu poruku od Denisa.",
  };
}

export type PushEnvelope = {
  type: PushNotifyType;
  title: string;
  body: string;
  url?: string;
  sound: boolean;
  urgent: boolean;
  soundProfile: PushSoundProfile;
  vibrate?: number[];
  broadcast: boolean;
};

export function buildStaffPushEnvelope(input: {
  pushType: PushNotifyType;
  message: string;
  tableName?: string;
  actionUrl?: string;
  priority?: "low" | "medium" | "high" | "urgent";
  playSound?: boolean;
}): PushEnvelope {
  const urgent = shouldBroadcastPushToAllStaff({
    type: input.pushType,
    priority: input.priority,
  });
  const soundProfile = resolvePushSoundProfile(input.pushType);
  const title =
    input.pushType === "staff-allergy"
      ? "Denis — ALERGIJA"
      : urgent
        ? "Denis — HITNO"
        : input.pushType === "new-order"
          ? "Novi order"
          : "Denis — staff alert";

  return {
    type: input.pushType,
    title,
    body: input.tableName
      ? `${input.tableName}: ${input.message}`
      : input.message,
    url: input.actionUrl,
    sound: input.playSound ?? (urgent || input.pushType === "new-order"),
    urgent,
    soundProfile,
    vibrate: resolvePushVibrate(input.pushType),
    broadcast: urgent,
  };
}
