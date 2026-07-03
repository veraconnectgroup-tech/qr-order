import type { ClientAccessibilitySignals } from "@/lib/denis/platform/accessibility-signals";
import { z } from "zod";
import {
  manualCartSnapshotSchema,
  deviceFingerprintSchema,
  denisSenseChannelSchema,
} from "@/lib/denis/platform/sense-types";
import { zSessionToken, zTableToken, zUuid } from "@/lib/security/zod-fields";
import type { GuestIntent } from "@/lib/denis/platform/timeline-types";
import type { SelectablePaymentMethod } from "@/lib/payment-methods";

const guestIntentSchema = z.enum([
  "ORDER",
  "CLARIFY_REPLY",
  "CONFIRM",
  "DECLINE",
  "DONE",
  "BROWSE",
  "STATUS",
  "HANDOFF_WAITER",
  "HANDOFF_PAY",
  "ORDER_CANCEL",
  "ORDER_MODIFY",
  "SMALLTALK",
  "UNKNOWN",
]);

const handoffPaymentMethodSchema = z.enum([
  "online",
  "at_bar",
  "card_at_table",
]);

const clientAccessibilitySignalsSchema = z.object({
  screenReader: z.boolean().optional(),
  browserZoom: z.number().optional(),
  prefersReducedMotion: z.boolean().optional(),
  voiceInput: z.boolean().optional(),
  coarsePointer: z.boolean().optional(),
});

export const denisSignalContextSchema = z.object({
  tableToken: zTableToken(),
  sessionToken: zSessionToken().optional(),
  locationId: zUuid().optional(),
  tableId: zUuid().optional(),
  tableSessionToken: zSessionToken().optional(),
  /** Idempotency key — Phase E Table Session Actor dedupe. */
  signalId: z.string().trim().min(8).max(128).optional(),
  language: z.string().trim().min(2).max(8).optional(),
  aiSessionId: zUuid().optional(),
  deviceFingerprint: deviceFingerprintSchema.optional(),
  deviceToken: z.string().trim().min(1).max(128).optional(),
  manualCartSnapshot: manualCartSnapshotSchema.optional(),
  allowOrdering: z.boolean().optional(),
  browsingContext: z.string().trim().max(500).optional(),
  /** Opt-in — response streams as newline-delimited JSON instead of one JSON blob. */
  stream: z.boolean().optional(),
  preferences: z
    .object({
      allergies: z.array(z.string()),
      mood: z.string(),
    })
    .optional(),
  accessibilitySignals: clientAccessibilitySignalsSchema.optional(),
});

export const denisMessageSignalSchema = denisSignalContextSchema.extend({
  type: z.literal("message"),
  text: z.string().trim().min(1).max(2000),
  surface: z.enum(["chat", "voice"]).optional(),
  structuredIntent: guestIntentSchema.optional(),
  handoffPaymentMethod: handoffPaymentMethodSchema.optional(),
  includeOrderContext: z.boolean().optional(),
});

export const denisChipSignalSchema = denisSignalContextSchema.extend({
  type: z.literal("chip"),
  chipId: z.string().trim().min(1).max(128),
  label: z.string().trim().min(1).max(200),
  structuredIntent: guestIntentSchema.optional(),
  handoffPaymentMethod: handoffPaymentMethodSchema.optional(),
});

export const denisTelemetrySignalSchema = denisSignalContextSchema.extend({
  type: z.literal("telemetry"),
  kind: z.enum(["cart", "scroll", "dwell", "proactive_tick", "browse"]),
  payload: z.record(z.string(), z.unknown()).optional().default({}),
});

export const denisSignalRequestSchema = z.discriminatedUnion("type", [
  denisMessageSignalSchema,
  denisChipSignalSchema,
  denisTelemetrySignalSchema,
]);

export type DenisSignalRequest = z.infer<typeof denisSignalRequestSchema>;

export type NormalizedDenisSignalRoute = "turn" | "sense" | "handoff";

export type NormalizedDenisSignal = {
  route: NormalizedDenisSignalRoute;
  request: DenisSignalRequest;
  channel: "chat" | "voice";
  structuredIntent?: GuestIntent;
  handoffPaymentMethod?: SelectablePaymentMethod;
  senseChannel?: z.infer<typeof denisSenseChannelSchema>;
};

export type NormalizeDenisSignalResult =
  | { ok: true; signal: NormalizedDenisSignal }
  | { ok: false; error: string };
