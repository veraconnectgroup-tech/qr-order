import { z } from "zod";

export const OrderSlotItemSchema = z.object({
  productId: z.string().uuid().nullable(),
  productNameRaw: z.string().trim().min(1).max(120).nullable(),
  quantity: z.number().int().min(1).max(99),
  serveSize: z.string().trim().max(40).nullable(),
  modifierIds: z.array(z.string().uuid()).max(20),
  notes: z.string().trim().max(200),
  confidence: z.number().min(0).max(1),
});

export const OrderSlotsSchema = z.object({
  items: z.array(OrderSlotItemSchema).max(20),
  unmappedSpans: z.array(z.string().trim().min(1).max(120)).max(10),
  tier: z.enum(["T0_heuristic", "T2_llm", "none"]),
});

export type OrderSlots = z.infer<typeof OrderSlotsSchema>;
export type OrderSlotItem = z.infer<typeof OrderSlotItemSchema>;
