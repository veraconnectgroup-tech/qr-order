import { z } from "zod";

export const DENIS_SESSION_UPDATE_REASONS = [
  "turn_complete",
  "handoff",
  "sense",
  "order_submitted",
] as const;

export type DenisSessionUpdateReason =
  (typeof DENIS_SESSION_UPDATE_REASONS)[number];

export const sessionOutcomeSchema = z.enum([
  "ordered",
  "abandoned",
  "handoff",
  "active",
]);

export const denisSessionUpdatedMetricsSchema = z.object({
  updateReason: z.enum(DENIS_SESSION_UPDATE_REASONS),
  status: z.string(),
  outcome: sessionOutcomeSchema,
  ordersCount: z.number().int().nonnegative(),
  turnCount: z.number().int().nonnegative(),
  intents: z.array(z.string()).optional(),
  viewVersion: z.number().int().nonnegative().optional(),
});

export type DenisSessionUpdatedMetrics = z.infer<
  typeof denisSessionUpdatedMetricsSchema
>;

export const denisSessionUpdatedPayloadSchema = z.object({
  orgId: z.string().uuid(),
  locationId: z.string().uuid(),
  sessionId: z.string().uuid(),
  outcome: sessionOutcomeSchema,
  metrics: denisSessionUpdatedMetricsSchema,
  traceId: z.string().optional(),
  created_at: z.string().datetime(),
  apiVersion: z.literal("2026-05-29"),
});

export type DenisSessionUpdatedPayload = z.infer<
  typeof denisSessionUpdatedPayloadSchema
>;

export function validateDenisSessionUpdatedPayload(
  payload: unknown
): DenisSessionUpdatedPayload {
  return denisSessionUpdatedPayloadSchema.parse(payload);
}
