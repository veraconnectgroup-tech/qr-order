export type NotificationKind = "transactional" | "marketing";

export type GuestNotificationChannel = "push" | "whatsapp" | "sms" | "email";

export type NotificationTemplateId =
  | "waitlist.table_ready"
  | "takeaway.order_ready"
  | "reservation.reminder_2h"
  | "engagement.win_back"
  | "engagement.birthday"
  | "engagement.weekly_special"
  | "engagement.loyalty_milestone"
  | "engagement.event_invite";

export type GuestNotificationPreferences = {
  locationId: string;
  deviceFingerprint: string;
  phoneE164: string | null;
  preferredChannel: GuestNotificationChannel | null;
  smsConsentAt: string | null;
  whatsappConsentAt: string | null;
  transactionalConsentAt: string | null;
  marketingConsentAt: string | null;
  unsubscribedAt: string | null;
  retentionExpiresAt: string | null;
};

export type RouteGuestNotificationInput = {
  locationId: string;
  deviceFingerprint: string;
  kind: NotificationKind;
  templateId: NotificationTemplateId;
  message: string;
  title?: string;
  url?: string;
  sessionId?: string | null;
  phone?: string | null;
  pushAvailable?: boolean;
};

export type RouteGuestNotificationResult = {
  sentVia: GuestNotificationChannel | null;
  skippedReason?: string;
};

export const DEFAULT_NOTIFICATION_RETENTION_DAYS = 90;
