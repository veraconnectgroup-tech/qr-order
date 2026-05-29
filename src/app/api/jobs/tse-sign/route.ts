export const maxDuration = 15;

import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { handleFiscalTseSign } from "@/lib/outbox/handlers/tse-sign";
import { verifyQStashSignature } from "@/lib/queue/verify";
import { withRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z
  .object({
    orderId: z.string().uuid().optional(),
    fiscalTransactionId: z.string().uuid().optional(),
  })
  .refine((value) => Boolean(value.orderId || value.fiscalTransactionId), {
    message: "orderId or fiscalTransactionId required",
  });

/** DLQ / QStash replay — routes through outbox handler (journal-first, G-M2). */
export const POST = withErrorHandler("jobs-tse-sign-post", async (req, _ctx) => {
  const limited = await withRateLimit(req, "jobs");
  if (limited) return limited;

  const valid = await verifyQStashSignature(req.clone());
  if (!valid) {
    return apiError("Unauthorized", 401);
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return apiError("Invalid input.", 400);
  }

  const admin = createAdminClient();
  let fiscalTransactionId = parsed.data.fiscalTransactionId ?? null;
  const orderId = parsed.data.orderId ?? null;

  if (!fiscalTransactionId && orderId) {
    const { data: pendingTx } = await admin
      .from("fiscal_transactions")
      .select("id")
      .eq("order_id", orderId)
      .eq("tx_type", "sale")
      .in("status", ["pending", "signing"])
      .maybeSingle();

    fiscalTransactionId =
      (pendingTx as { id: string } | null)?.id ?? null;
  }

  await handleFiscalTseSign({
    fiscalTransactionId: fiscalTransactionId ?? undefined,
    orderId: orderId ?? undefined,
  });

  return apiSuccess({
    ok: true,
    fiscalTransactionId,
    orderId,
  });
});
