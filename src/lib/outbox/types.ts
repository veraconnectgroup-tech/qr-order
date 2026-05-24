export type OutboxDomain = "fulfillment" | "fiscal" | "integration";

export type OutboxEventType =
  | "fulfill.notify_staff"
  | "fulfill.push_pos"
  | "fulfill.notify_pos_payment"
  | "fulfill.cloud_print"
  | "fiscal.tse_sign"
  | "fiscal.beleg"
  | "fiscal.send_receipt"
  | "integration.webhook";

export type OutboxInsert = {
  aggregate_type?: "order";
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
