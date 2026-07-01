/** Handler fails this many times → dead letter queue (Prompt 60). */
export const OUTBOX_MAX_ATTEMPTS = 3;

export type OutboxHandlerMetric = {
  eventType: string;
  throughput: number;
  failed: number;
  deadLetter: number;
  failureRate: number;
  avgLatencyMs: number;
};

export type OutboxDomain =
  | "fulfillment"
  | "fiscal"
  | "integration"
  | "session"
  | "billing"
  | "commerce";

export type OutboxEventType =
  | "fulfill.notify_staff"
  | "fulfill.push_pos"
  | "session.paid_online"
  | "fulfill.cloud_print"
  | "fiscal.tse_sign"
  | "fiscal.beleg"
  | "fiscal.send_receipt"
  | "integration.webhook"
  | "billing.low_balance"
  | "billing.staff_hint"
  | "billing.trial_ending"
  | "billing.usage_exceeded"
  | "billing.actionable_insights"
  | "commerce.projection.refresh"
  | "commerce.alert.staff"
  | "commerce.denis.world"
  | "commerce.preorder.release"
  | "session.scene.refresh"
  | "session.eval"
  | "notification.sms.send"
  | "notification.whatsapp.send";

export type OutboxInsert = {
  aggregate_type?: "order" | "session";
  aggregate_id: string;
  domain: OutboxDomain;
  event_type: OutboxEventType;
  payload: Record<string, unknown>;
};

export type OrderEventType =
  | "order.created"
  | "order.approval_requested"
  | "order.approved";

export type PosIntegrationContext = {
  id: string;
  provider: string;
  status: "disconnected" | "connected" | "error";
};

export type CloudPrinterContext = {
  id: string;
  provider: string;
  autoPrint: boolean;
};

export type WebhookContext = {
  id: string;
  url: string;
};

export type OrderOutboxContext = {
  orderId: string;
  locationId: string;
  orgId: string;
  orderNumber: number;
  tableName: string;
  total: number;
  paymentStatus: string;
  guestEmail?: string | null;
  orderSource?: string;
  posIntegration: PosIntegrationContext | null;
  cloudPrinters: CloudPrinterContext[];
  activeWebhooks: WebhookContext[];
};

export type OrderSideEffectPhase = "created" | "approval_requested" | "approved";
