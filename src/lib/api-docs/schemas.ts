import { z } from "zod";

/** Canonical API error codes documented in OpenAPI (AH1). */
export const API_ERROR_CODES = {
  RATE_LIMITED: "rate_limited",
  CART_EMPTY: "cart_empty",
  SESSION_EXPIRED: "session_expired",
  CIRCUIT_OPEN: "circuit_open",
  CREDIT_EXHAUSTED: "credit_exhausted",
  INVALID_INPUT: "invalid_input",
  MODERATION_BLOCKED: "moderation_blocked",
  PAYMENT_FAILED: "payment_failed",
  ORDER_CONFLICT: "order_conflict",
  LOCATION_CLOSED: "location_closed",
  INTERNAL: "internal",
  UNAUTHORIZED: "unauthorized",
} as const;

/** Shared API error body (AH1 error codes). */
export const apiErrorSchema = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.enum([
      API_ERROR_CODES.RATE_LIMITED,
      API_ERROR_CODES.CART_EMPTY,
      API_ERROR_CODES.SESSION_EXPIRED,
      API_ERROR_CODES.CIRCUIT_OPEN,
      API_ERROR_CODES.CREDIT_EXHAUSTED,
      API_ERROR_CODES.INVALID_INPUT,
      API_ERROR_CODES.MODERATION_BLOCKED,
      API_ERROR_CODES.PAYMENT_FAILED,
      API_ERROR_CODES.ORDER_CONFLICT,
      API_ERROR_CODES.LOCATION_CLOSED,
      API_ERROR_CODES.INTERNAL,
      API_ERROR_CODES.UNAUTHORIZED,
    ]),
    message: z.string(),
    traceId: z.string().optional(),
    retryable: z.boolean(),
  }),
});

export const chatTurnRequestSchema = z.object({
  message: z.string().max(500),
  sessionToken: z.string(),
  tableSlug: z.string().optional(),
  locationSlug: z.string().optional(),
  deviceFingerprint: z.string().optional(),
});

export const chatTurnResponseSchema = z.object({
  ok: z.literal(true),
  data: z
    .object({
      message: z.string(),
      quickReplies: z
        .array(
          z.object({
            text: z.string(),
            action: z.string().optional(),
          })
        )
        .optional(),
      cartActions: z
        .array(
          z.object({
            type: z.enum(["add", "remove", "update"]),
            productId: z.string(),
            quantity: z.number(),
          })
        )
        .optional(),
      submitOrder: z.boolean().optional(),
    })
    .nullable(),
  error: z.null(),
});

export const denisSenseRequestSchema = z.object({
  sessionToken: z.string(),
  message: z.string().max(2000),
  deviceFingerprint: z.string().optional(),
});

export const stripeWebhookExampleSchema = z.object({
  id: z.string(),
  type: z.string(),
  data: z.object({
    object: z.record(z.string(), z.unknown()),
  }),
});

export const deliverectWebhookExampleSchema = z.object({
  orderId: z.string(),
  status: z.string(),
  locationId: z.string().optional(),
});

export function schemaToOpenApi(schema: z.ZodType, name: string) {
  return {
    ...z.toJSONSchema(schema),
    title: name,
  };
}
