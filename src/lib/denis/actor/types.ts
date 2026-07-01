export type TableSessionSignalKind = "guest" | "world" | "experience" | "proactive";

export type QueuedProactiveTickPayload = {
  tableSessionId: string;
  source: "session.watcher" | "scheduler.wakeup" | "sense.proactive_brain";
  traceId: string;
  /** Watcher cron already ran mental-model / offer preamble before enqueue. */
  preambleDone?: boolean;
};

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
  /** ADR-041 P1 — system.proactive_tick via table session actor. */
  proactivePayload?: QueuedProactiveTickPayload;
};

export type StoredSignalHttpResult = {
  status: number;
  body: unknown;
};
