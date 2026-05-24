export type PosInboundEventType =
  | "order.created"
  | "order.cancelled"
  | "table.closed";

export type PosInboundPaymentState = "PAID" | "UNPAID";

export type PosInboundOrderItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  notes?: string | null;
  taxRate?: number;
  modifiers?: Array<{ name: string; price: number }>;
};

export type PosInboundOrderDraft = {
  externalOrderId: string;
  externalLocationId?: string | null;
  tableName?: string | null;
  externalTableId?: string | null;
  items: PosInboundOrderItem[];
  subtotal: number;
  taxPercent: number;
  taxAmount: number;
  total: number;
  currency?: string;
  paymentState: PosInboundPaymentState;
  notes?: string | null;
  createdAt?: string;
  status?: "accepted" | "preparing";
};

export type PosInboundTableClosedEvent = {
  externalTableId?: string | null;
  tableName?: string | null;
  settlement: "paid_at_pos" | "unpaid";
  externalSessionId?: string | null;
};

export type PosInboundEvent =
  | { type: "order.created"; order: PosInboundOrderDraft }
  | { type: "order.cancelled"; externalOrderId: string }
  | { type: "table.closed"; table: PosInboundTableClosedEvent }
  | { type: "reject"; reason: string };

export type PosInboundAdapter = {
  provider: string;
  verifyWebhookSignature(
    rawBody: string,
    headers: Headers,
    config: Record<string, unknown>
  ): boolean;
  parseEvent(
    rawBody: Record<string, unknown>,
    headers?: Headers
  ): PosInboundEvent;
};

export type CreatePosOrderResult =
  | {
      ok: true;
      orderId: string;
      orderNumber: number;
      total: number;
      sessionId: string;
      alreadyExisted: boolean;
      tableName: string;
    }
  | { ok: false; status: number; message: string };

export type InboundWebhookResult =
  | { ok: true; status: number; body: Record<string, unknown> }
  | { ok: false; status: number; message: string };
