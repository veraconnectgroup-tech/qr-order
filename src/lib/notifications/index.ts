export type { SendSmsInput, SendSmsResult } from "./sms-provider";
export { sendSms, isSmsConfigured } from "./sms-provider";
export type { SendWhatsAppInput, SendWhatsAppResult } from "./whatsapp-provider";
export { sendWhatsApp, isWhatsAppConfigured } from "./whatsapp-provider";
export {
  routeGuestNotification,
  DEFAULT_CHANNEL_ORDER,
  resolveChannelOrder,
} from "./channel-router";
export {
  loadGuestNotificationPreferences,
  upsertGuestNotificationPreferences,
  processSmsStopUnsubscribe,
  purgeExpiredNotificationPreferences,
  isStopKeyword,
  hasChannelConsent,
  isGuestSubscribed,
  logGuestNotificationSend,
} from "./guest-preferences";
export {
  NOTIFICATION_TEMPLATES,
  getNotificationTemplate,
  buildWaitlistTableReadySms,
  buildReservationReminderMessage,
  buildTakeawayReadySms,
  buildWinBackSms,
  buildBirthdaySms,
  shouldSendReservationReminder,
} from "./templates";
export type {
  GuestNotificationChannel,
  GuestNotificationPreferences,
  NotificationKind,
  NotificationTemplateId,
  RouteGuestNotificationInput,
  RouteGuestNotificationResult,
} from "./types";
