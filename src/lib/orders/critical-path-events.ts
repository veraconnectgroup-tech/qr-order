import { logger } from "@/lib/logger";

/** Structured lifecycle events for order tracing in production logs / Sentry. */
export const criticalPath = {
  orderCreated(metadata: {
    orderId: string;
    source: string;
    locationId: string;
    total: number;
    paymentMethod: string;
  }) {
    logger.info("order.created", metadata);
  },

  paymentStarted(metadata: {
    orderId: string;
    method: string;
    intentId?: string;
  }) {
    logger.info("order.payment.started", metadata);
  },

  paymentCompleted(metadata: {
    orderId: string;
    method: string;
    duration_ms: number;
  }) {
    logger.info("order.payment.completed", metadata);
  },

  paymentFailed(metadata: {
    orderId: string;
    method: string;
    error: string;
    retryable: boolean;
  }) {
    logger.warn("order.payment.failed", metadata);
  },

  tseSigned(metadata: {
    orderId: string;
    duration_ms: number;
    signatureCounter?: number;
  }) {
    logger.info("order.tse.signed", metadata);
  },

  tseDeferred(metadata: { orderId: string; reason: string }) {
    logger.warn("order.tse.deferred", metadata);
  },

  outboxProcessed(metadata: {
    eventId: string;
    domain: string;
    eventType: string;
    duration_ms: number;
  }) {
    logger.info("outbox.processed", metadata);
  },

  outboxFailed(metadata: {
    eventId: string;
    attempts: number;
    maxAttempts: number;
    error: string;
  }) {
    logger.warn("outbox.failed", metadata);
  },

  outboxDeadLetter(metadata: { eventId: string; totalAttempts: number }) {
    logger.error("outbox.dead_letter", metadata);
  },
};
