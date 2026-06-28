/** W1 — Rich Denis operational webhook events for POS/CRM/inventory integrations. */

export const DENIS_EXTENDED_WEBHOOK_EVENTS = [
  "denis.order.submitted",
  "denis.order.delivered",
  "denis.guest.arrived",
  "denis.guest.left",
  "denis.guest.feedback",
  "denis.upsell.converted",
  "denis.allergy.detected",
  "denis.rush.started",
  "denis.rush.ended",
  "denis.stock.depleted",
  "denis.revenue.milestone",
  "denis.staff.alert",
] as const;

export type DenisExtendedWebhookEvent =
  (typeof DENIS_EXTENDED_WEBHOOK_EVENTS)[number];

export type OrderSubmittedItem = {
  productId: string;
  name: string;
  quantity: number;
  price: number;
};

export type OrderSubmittedData = {
  orderId: string;
  orderNumber: number;
  tableId: string;
  tableName: string;
  items: OrderSubmittedItem[];
  total: number;
  guestLanguage: string | null;
  isReturningGuest: boolean;
  allergyFlags: string[];
};

export type OrderDeliveredData = {
  orderId: string;
  orderNumber: number;
  tableId: string;
  tableName: string;
  deliveredAt: string;
  total: number;
};

export type GuestArrivedData = {
  sessionId: string;
  tableId: string;
  tableName: string;
  isReturningGuest: boolean;
  guestLanguage: string | null;
};

export type GuestLeftData = {
  sessionId: string;
  tableId: string;
  tableName: string;
  orderCount: number;
  totalSpent: number;
  durationMinutes: number;
};

export type GuestFeedbackData = {
  sessionId: string;
  rating: number | null;
  sentiment: "positive" | "neutral" | "negative" | null;
  tags: string[];
};

export type UpsellConvertedData = {
  sessionId: string;
  productId: string;
  productName: string;
  offerType: string;
};

export type AllergyDetectedData = {
  sessionId: string;
  tableId: string;
  allergens: string[];
  productId: string | null;
  productName: string | null;
  severity: "block" | "warn";
};

export type RushModeData = {
  locationId: string;
  reason: string;
  kdsStress: "normal" | "high";
};

export type StockDepletedData = {
  productId: string;
  productName: string;
  previousStock: number | null;
};

export type RevenueMilestoneData = {
  date: string;
  milestoneCents: number;
  currentRevenueCents: number;
};

export type StaffAlertData = {
  alertType: string;
  message: string;
  tableId: string | null;
  priority: "low" | "medium" | "high";
};

export type WebhookDataMap = {
  "denis.order.submitted": OrderSubmittedData;
  "denis.order.delivered": OrderDeliveredData;
  "denis.guest.arrived": GuestArrivedData;
  "denis.guest.left": GuestLeftData;
  "denis.guest.feedback": GuestFeedbackData;
  "denis.upsell.converted": UpsellConvertedData;
  "denis.allergy.detected": AllergyDetectedData;
  "denis.rush.started": RushModeData;
  "denis.rush.ended": RushModeData;
  "denis.stock.depleted": StockDepletedData;
  "denis.revenue.milestone": RevenueMilestoneData;
  "denis.staff.alert": StaffAlertData;
};

export type ExtendedWebhookPayload<T extends DenisExtendedWebhookEvent> = {
  event: T;
  timestamp: string;
  orgId: string;
  locationId: string;
  data: WebhookDataMap[T];
};

export function isDenisExtendedWebhookEvent(
  event: string
): event is DenisExtendedWebhookEvent {
  return (DENIS_EXTENDED_WEBHOOK_EVENTS as readonly string[]).includes(event);
}

const FORBIDDEN_PII_KEYS = [
  "guest_name",
  "guestName",
  "guest_phone",
  "guestPhone",
  "guest_email",
  "guestEmail",
  "session_token",
  "qr_token",
  "device_fingerprint",
  "payment_instrument",
];

/** Ensures extended webhook payloads contain no guest PII. */
export function extendedWebhookPayloadHasNoPii(
  payload: Record<string, unknown>
): boolean {
  const serialized = JSON.stringify(payload).toLowerCase();
  return !FORBIDDEN_PII_KEYS.some((key) => serialized.includes(key));
}
