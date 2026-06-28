import type { SupabaseClient } from "@supabase/supabase-js";
import {
  signFiscalJournalStorno,
  signFiscalJournalTransaction,
} from "@/lib/fiscal/runtime/sign-journal-transaction";
import { signFiscalJournalZClosing } from "@/lib/fiscal/runtime/sign-journal-z-closing";
import { isFiskalyConfigured } from "@/lib/fiscal/fiskaly";
import { logger } from "@/lib/logger";

export type PendingFiscalTransactionRow = {
  id: string;
  tx_type: "sale" | "storno" | "z_closing" | string;
  order_id: string | null;
  location_id: string;
  org_id: string;
};

export type ReplayPendingFiscalResult = {
  attempted: number;
  signed: number;
  stillPending: number;
  skipped: boolean;
  errors: Array<{ fiscalTransactionId: string; error: string }>;
};

async function signPendingTransaction(
  row: PendingFiscalTransactionRow
): Promise<boolean> {
  switch (row.tx_type) {
    case "storno": {
      const result = await signFiscalJournalStorno(row.id);
      return result != null;
    }
    case "z_closing": {
      const result = await signFiscalJournalZClosing(row.id);
      return result != null;
    }
    default: {
      const result = await signFiscalJournalTransaction(row.id);
      return result != null;
    }
  }
}

/** Replay journal rows left in `pending` when Fiskaly TSE was offline. */
export async function replayPendingFiscalTransactions(
  admin: SupabaseClient,
  options?: { limit?: number; lookbackHours?: number }
): Promise<ReplayPendingFiscalResult> {
  if (!isFiskalyConfigured()) {
    return {
      attempted: 0,
      signed: 0,
      stillPending: 0,
      skipped: true,
      errors: [],
    };
  }

  const limit = options?.limit ?? 50;
  const lookbackHours = options?.lookbackHours ?? 72;
  const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000).toISOString();

  const { data: rows, error } = await admin
    .from("fiscal_transactions")
    .select("id, tx_type, order_id, location_id, org_id")
    .eq("status", "pending")
    .in("tx_type", ["sale", "storno", "z_closing"])
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`pending fiscal replay query failed: ${error.message}`);
  }

  const pending = (rows ?? []) as PendingFiscalTransactionRow[];
  let signed = 0;
  const errors: ReplayPendingFiscalResult["errors"] = [];

  for (const row of pending) {
    try {
      const ok = await signPendingTransaction(row);
      if (ok) {
        signed += 1;
        logger.info("Fiscal pending transaction replay signed", {
          fiscalTransactionId: row.id,
          txType: row.tx_type,
          orderId: row.order_id,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ fiscalTransactionId: row.id, error: message });
      logger.warn("Fiscal pending transaction replay failed", {
        fiscalTransactionId: row.id,
        txType: row.tx_type,
        error: message,
      });
    }
  }

  return {
    attempted: pending.length,
    signed,
    stillPending: pending.length - signed,
    skipped: false,
    errors,
  };
}
