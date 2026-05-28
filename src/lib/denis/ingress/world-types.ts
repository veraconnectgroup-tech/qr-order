import { z } from "zod";
import { zUuid } from "@/lib/security/zod-fields";

export const COMMERCE_WORLD_SIGNALS = [
  "commerce.order_created",
  "commerce.order_status",
] as const;

export type CommerceWorldSignalKind = (typeof COMMERCE_WORLD_SIGNALS)[number];

export const commerceDenisWorldPayloadSchema = z.object({
  signal: z.enum(COMMERCE_WORLD_SIGNALS),
  orderId: zUuid(),
  sessionId: zUuid(),
  locationId: zUuid(),
  tableId: zUuid(),
  tableToken: z.string().trim().min(1).max(128),
  orderNumber: z.number().int().positive(),
  status: z.string().trim().min(1).max(32),
  previousStatus: z.string().trim().min(1).max(32).optional(),
});

export type CommerceDenisWorldPayload = z.infer<
  typeof commerceDenisWorldPayloadSchema
>;
