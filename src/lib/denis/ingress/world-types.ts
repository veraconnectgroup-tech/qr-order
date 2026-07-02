import { z } from "zod";
import { zUuid } from "@/lib/security/zod-fields";

export const COMMERCE_WORLD_SIGNALS = [
  "commerce.order_created",
  "commerce.order_status",
  "commerce.product_unavailable",
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
  stationTell: z
    .object({
      station: z.enum(["kitchen", "bar"]),
    })
    .optional(),
  productTell: z
    .object({
      productId: zUuid(),
      productName: z.string().trim().min(1).max(200),
      message: z.string().trim().min(1).max(500),
    })
    .optional(),
});

export type CommerceDenisWorldPayload = z.infer<
  typeof commerceDenisWorldPayloadSchema
>;
