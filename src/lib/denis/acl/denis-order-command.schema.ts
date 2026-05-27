import { z } from "zod";
import { zSessionToken, zTableToken } from "@/lib/security/zod-fields";

export const DenisOrderCommandLineSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(99),
  serveSize: z.string().trim().max(40).nullable(),
  modifierIds: z.array(z.string().uuid()).max(20),
  notes: z.string().trim().max(200),
  expectedUnitPrice: z.number().positive(),
});

export const DenisOrderCommandSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(128),
  aiSessionId: z.string().uuid(),
  tableToken: zTableToken(),
  sessionToken: zSessionToken().optional(),
  deviceFingerprint: z.string().trim().min(8).max(128),
  deviceToken: z.string().trim().min(16).max(256).optional(),
  lines: z.array(DenisOrderCommandLineSchema).min(1).max(50),
});

export type DenisOrderCommand = z.infer<typeof DenisOrderCommandSchema>;
export type DenisOrderCommandLine = z.infer<typeof DenisOrderCommandLineSchema>;
