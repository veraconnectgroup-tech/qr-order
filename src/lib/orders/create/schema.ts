import { z } from "zod";
import {
  MAX_ITEMS_PER_ORDER,
  MAX_QUANTITY_PER_ITEM,
} from "@/lib/security/order-limits";
import {
  zOptionalEmailNormalized,
  zOrderNotesNullish,
  zOrderNotesOptional,
  zSessionToken,
  zTableToken,
} from "@/lib/security/zod-fields";

const cartItemSchema = z.object({
  productId: z.string().uuid(),
  productName: z.string().min(1).max(200),
  unitPrice: z.number().positive(),
  quantity: z.number().int().min(1).max(MAX_QUANTITY_PER_ITEM),
  notes: zOrderNotesNullish(),
  serveSize: z.string().trim().max(20).nullish(),
  modifiers: z.array(
    z.object({
      modifierId: z.string().uuid(),
      modifierName: z.string().max(200),
      price: z.number().min(0),
    })
  ),
  itemTotal: z.number().positive(),
});

export const createOrderSchema = z.object({
  sessionToken: zSessionToken().optional(),
  tableToken: zTableToken(),
  deviceFingerprint: z.string().min(8).max(128),
  deviceToken: z.string().min(16).max(256).optional(),
  tablePin: z
    .string()
    .regex(/^\d{4}$/)
    .optional(),
  items: z.array(cartItemSchema).min(1).max(MAX_ITEMS_PER_ORDER),
  notes: zOrderNotesOptional(500),
  guestEmail: zOptionalEmailNormalized(),
  isTakeaway: z.boolean().optional().default(false),
  paymentMethod: z
    .enum(["unset", "online", "at_bar", "card_at_table"])
    .default("unset"),
  promoCodeId: z.string().uuid().optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export type CartItemInput = CreateOrderInput["items"][number];
