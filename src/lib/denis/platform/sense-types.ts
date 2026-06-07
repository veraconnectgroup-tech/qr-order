import { z } from "zod";
import { zSessionToken, zUuid } from "@/lib/security/zod-fields";
import type { PerceptionChannel } from "@/lib/denis/platform/timeline-types";

export const deviceFingerprintSchema = z.string().trim().min(8).max(128);

export const manualCartSnapshotSchema = z.object({
  revision: z.number().int().nonnegative(),
  updatedAt: z.string(),
  items: z.array(
    z.object({
      productId: z.string().uuid(),
      productName: z.string().trim().min(1).max(200),
      quantity: z.number().int().positive(),
      serveSize: z.string().nullable(),
      lineTotal: z.number(),
      modifierIds: z.array(z.string().uuid()).optional(),
      menuSection: z.string().nullable().optional(),
    })
  ),
});

export type ManualCartSnapshotInput = z.infer<typeof manualCartSnapshotSchema>;

export const denisSenseChannelSchema = z.enum([
  "telemetry.manual_cart",
  "telemetry.scroll",
  "realtime.order_status",
  "ui.conversion",
  "system.proactive_tick",
]);

export const denisSenseRequestSchema = z.object({
  locationId: zUuid(),
  tableId: zUuid(),
  sessionToken: zSessionToken(),
  /** Guest table session token when `sessionToken` is the QR aiContext token. */
  tableSessionToken: zSessionToken().optional(),
  aiSessionId: zUuid().optional(),
  channel: denisSenseChannelSchema,
  payload: z.record(z.string(), z.unknown()).optional().default({}),
  manualCartSnapshot: manualCartSnapshotSchema.optional(),
  deviceFingerprint: deviceFingerprintSchema.optional(),
});

export type DenisSenseRequest = z.infer<typeof denisSenseRequestSchema>;

export type DenisSenseChannel = z.infer<typeof denisSenseChannelSchema>;

export function senseChannelToPerception(
  channel: DenisSenseChannel
): PerceptionChannel {
  return channel;
}
