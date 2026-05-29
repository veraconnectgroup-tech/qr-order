import type { SupabaseClient } from "@supabase/supabase-js";
import { getFiskalyClient, isFiskalyConfigured } from "@/lib/fiscal/fiskaly";
import { auditLog } from "@/lib/audit/log";
import { logger } from "@/lib/logger";

export type FiscalReconcileMismatch = {
  fiscalTransactionId: string;
  orderId: string | null;
  orgId: string;
  locationId: string;
  fiskalyTxId: string;
  issue: string;
};

export type FiscalReconcileResult = {
  checked: number;
  mismatches: FiscalReconcileMismatch[];
  skipped: boolean;
};

type SignedJournalRow = {
  id: string;
  order_id: string | null;
  org_id: string;
  location_id: string;
  fiskaly_tx_id: string | null;
  tse_signature: string | null;
  fiscal_registers: { fiskaly_tss_id: string } | { fiskaly_tss_id: string }[] | null;
};

/** Compare signed journal rows against Fiskaly API (G-M4). */
export async function reconcileFiscalJournal(
  admin: SupabaseClient,
  options?: { lookbackHours?: number }
): Promise<FiscalReconcileResult> {
  if (!isFiskalyConfigured()) {
    return { checked: 0, mismatches: [], skipped: true };
  }

  const lookbackHours = options?.lookbackHours ?? 48;
  const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000).toISOString();

  const { data: rows, error } = await admin
    .from("fiscal_transactions")
    .select(
      `
      id, order_id, org_id, location_id, fiskaly_tx_id, tse_signature,
      fiscal_registers ( fiskaly_tss_id )
    `
    )
    .eq("status", "signed")
    .in("tx_type", ["sale", "storno", "z_closing"])
    .gte("signed_at", since)
    .not("fiskaly_tx_id", "is", null);

  if (error) {
    throw new Error(`fiscal reconcile query failed: ${error.message}`);
  }

  const client = getFiskalyClient();
  const mismatches: FiscalReconcileMismatch[] = [];

  for (const raw of rows ?? []) {
    const row = raw as SignedJournalRow;
    const register = Array.isArray(row.fiscal_registers)
      ? row.fiscal_registers[0]
      : row.fiscal_registers;

    if (!register?.fiskaly_tss_id || !row.fiskaly_tx_id) {
      continue;
    }

    try {
      const remote = await client.getTransaction(
        register.fiskaly_tss_id,
        row.fiskaly_tx_id
      );
      const remoteSignature = remote.signature?.value?.trim() ?? "";
      const localSignature = row.tse_signature?.trim() ?? "";

      if (remoteSignature && localSignature && remoteSignature !== localSignature) {
        mismatches.push({
          fiscalTransactionId: row.id,
          orderId: row.order_id,
          orgId: row.org_id,
          locationId: row.location_id,
          fiskalyTxId: row.fiskaly_tx_id,
          issue: "signature_mismatch",
        });
      }

      if (remote.state && remote.state !== "FINISHED") {
        mismatches.push({
          fiscalTransactionId: row.id,
          orderId: row.order_id,
          orgId: row.org_id,
          locationId: row.location_id,
          fiskalyTxId: row.fiskaly_tx_id,
          issue: `unexpected_fiskaly_state:${remote.state}`,
        });
      }
    } catch (err) {
      mismatches.push({
        fiscalTransactionId: row.id,
        orderId: row.order_id,
        orgId: row.org_id,
        locationId: row.location_id,
        fiskalyTxId: row.fiskaly_tx_id,
        issue: err instanceof Error ? err.message : "fiskaly_lookup_failed",
      });
    }
  }

  for (const mismatch of mismatches) {
    logger.error("Fiscal reconcile mismatch", mismatch);
    await auditLog({
      orgId: mismatch.orgId,
      action: "fiscal",
      entityType: "fiscal_transaction",
      entityId: mismatch.fiscalTransactionId,
      newValue: mismatch,
    });
  }

  logger.info("Fiscal reconcile completed", {
    checked: (rows ?? []).length,
    mismatches: mismatches.length,
    lookbackHours,
  });

  return {
    checked: (rows ?? []).length,
    mismatches,
    skipped: false,
  };
}
