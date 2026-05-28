export type TableSessionSignalKind = "guest" | "world" | "experience";

export type QueuedExperienceSignal = {
  triggerKind: "payment_settled" | "order_delivered";
  orderId: string;
  traceId?: string;
  idempotencyKey: string;
};

export type QueuedTableSessionSignal = {
  signalId: string;
  kind: TableSessionSignalKind;
  enqueuedAt: string;
  rawBody?: unknown;
  /** commerce.denis.world payload — validated in runtime layer. */
  worldPayload?: Record<string, unknown>;
  experiencePayload?: QueuedExperienceSignal;
};

export type StoredSignalHttpResult = {
  status: number;
  body: unknown;
};
