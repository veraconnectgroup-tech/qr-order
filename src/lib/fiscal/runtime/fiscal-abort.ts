import type { SupabaseClient } from "@supabase/supabase-js";
import { getFiskalyClient, isFiskalyConfigured } from "@/lib/fiscal/fiskaly";
import { logger } from "@/lib/logger";

/** AVBelegabbruch — cancel pending fiscal sale before TSE sign (pre-payment reject). */
export async function abortPendingFiscalSale(
  admin: SupabaseClient,
  orderId: string
): Promise<{ aborted: boolean; fiscalTransactionId?: string }> {
  const { data: pendingTx } = await admin
    .from("fiscal_transactions")
    .select("id, register_id, status, fiscal_registers ( fiskaly_tss_id, fiskaly_client_id )")
    .eq("order_id", orderId)
    .eq("tx_type", "sale")
    .in("status", ["pending", "signing"])
    .maybeSingle();

  if (!pendingTx) {
    return { aborted: false };
  }

  const row = pendingTx as {
    id: string;
    status: string;
    fiscal_registers:
      | { fiskaly_tss_id: string; fiskaly_client_id: string }
      | { fiskaly_tss_id: string; fiskaly_client_id: string }[]
      | null;
  };

  const register = Array.isArray(row.fiscal_registers)
    ? row.fiscal_registers[0]
    : row.fiscal_registers;

  if (isFiskalyConfigured() && register) {
    try {
      const fiskaly = getFiskalyClient();
      await fiskaly.createTransaction(register.fiskaly_tss_id, {
        tx_id: crypto.randomUUID(),
        client_id: register.fiskaly_client_id,
        schema: {
          standard_v1: {
            receipt: {
              receipt_type: "CANCELLATION",
              amounts_per_vat_rate: [],
              amounts_per_payment_type: [],
            },
          },
        },
        metadata: {
          order_id: orderId,
          fiscal_abort: "true",
          aborted_fiscal_tx_id: row.id,
        },
      });
    } catch (error) {
      logger.warn("fiscal.abort Fiskaly CANCELLATION failed", {
        orderId,
        fiscalTransactionId: row.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  await admin
    .from("fiscal_transactions")
    .update({
      status: "failed",
      failure_reason: "aborted_before_sign",
    } as never)
    .eq("id", row.id)
    .in("status", ["pending", "signing"]);

  return { aborted: true, fiscalTransactionId: row.id };
}
