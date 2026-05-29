import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

export async function recordFiscalHandoff(
  admin: SupabaseClient,
  input: {
    orderId: string;
    locationId: string;
    orgId: string;
    posProvider: string;
    posExternalId?: string | null;
    posReceiptRef?: string | null;
  }
): Promise<void> {
  const { error } = await admin.from("fiscal_handoffs").upsert(
    {
      order_id: input.orderId,
      location_id: input.locationId,
      org_id: input.orgId,
      pos_provider: input.posProvider,
      pos_external_id: input.posExternalId ?? null,
      pos_receipt_ref: input.posReceiptRef ?? null,
    },
    { onConflict: "order_id" }
  );

  if (error) {
    logger.warn("fiscal_handoffs upsert failed", {
      orderId: input.orderId,
      error: error.message,
    });
    return;
  }

  logger.info("Fiscal handoff recorded", {
    orderId: input.orderId,
    posProvider: input.posProvider,
    posExternalId: input.posExternalId,
  });
}
