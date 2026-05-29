import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type DailyClosingData,
  saveDailyClosing,
  signDailyClosingTse,
  type VatSummaryEntry,
} from "@/lib/fiscal/daily-closing";
import { ensureFiscalRegister } from "@/lib/fiscal/runtime/ensure-fiscal-register";
import { signFiscalJournalZClosing } from "@/lib/fiscal/runtime/sign-journal-z-closing";
import { logger } from "@/lib/logger";

function vatSummaryToJournalLines(vatSummary: VatSummaryEntry[]) {
  if (vatSummary.length === 0) {
    return [
      {
        line_no: 1,
        product_name: "Tagesabschluss",
        quantity: 1,
        tax_rate: 19,
        gross: 0,
        net: 0,
        tax: 0,
      },
    ];
  }

  return vatSummary.map((row, index) => ({
    line_no: index + 1,
    product_name: `MwSt ${row.rate}%`,
    quantity: 1,
    tax_rate: row.rate,
    gross: row.gross,
    net: row.net,
    tax: row.tax,
  }));
}

export type FiscalZClosingResult = {
  id: string;
  fiscalTransactionId: string | null;
  zNr: number | null;
  data: DailyClosingData;
};

/** Journal-first Z-Bon: finalize z_closing RPC → TSE sign → daily_closings projection. */
export async function runFiscalZClosingPipeline(
  admin: SupabaseClient,
  data: DailyClosingData,
  closedBy?: string | null
): Promise<FiscalZClosingResult> {
  const register = await ensureFiscalRegister(
    admin,
    data.locationId,
    data.orgId
  );

  if (!register) {
    const { id, zNr } = await saveDailyClosing(admin, data, closedBy);
    await signDailyClosingTse(admin, id, data.orgId);
    return { id, fiscalTransactionId: null, zNr, data };
  }

  const idempotencyKey = `z_closing:${data.locationId}:${data.businessDate}`;

  const { data: rpcRows, error: rpcError } = await admin.rpc(
    "finalize_fiscal_z_closing" as never,
    {
      p_register_id: register.id,
      p_org_id: data.orgId,
      p_location_id: data.locationId,
      p_business_date: data.businessDate,
      p_idempotency_key: idempotencyKey,
      p_currency: "EUR",
      p_gross_total: data.totalGross,
      p_net_total: data.totalNet,
      p_tax_total: data.totalTax,
      p_total_cash: data.totalCash,
      p_total_non_cash: data.totalNonCash,
      p_order_count: data.orderCount,
      p_refund_count: data.refundCount,
      p_refund_total: data.refundTotal,
      p_lines: vatSummaryToJournalLines(data.vatSummary),
    } as never
  );

  if (rpcError) {
    throw new Error(`finalize_fiscal_z_closing failed: ${rpcError.message}`);
  }

  const rpcRow = Array.isArray(rpcRows)
    ? (rpcRows[0] as { fiscal_transaction_id: string; z_nr: number })
    : null;

  if (!rpcRow?.fiscal_transaction_id) {
    throw new Error("finalize_fiscal_z_closing returned no transaction id");
  }

  const { id, zNr } = await saveDailyClosing(admin, data, closedBy, {
    fiscalTransactionId: rpcRow.fiscal_transaction_id,
    zNr: rpcRow.z_nr,
  });

  await signFiscalJournalZClosing(rpcRow.fiscal_transaction_id, {
    total_cash: data.totalCash,
    total_non_cash: data.totalNonCash,
    vat_summary: data.vatSummary,
  });

  logger.info("Fiscal Z closing pipeline completed", {
    closingId: id,
    fiscalTransactionId: rpcRow.fiscal_transaction_id,
    zNr: rpcRow.z_nr ?? zNr,
    locationId: data.locationId,
    businessDate: data.businessDate,
  });

  return {
    id,
    fiscalTransactionId: rpcRow.fiscal_transaction_id,
    zNr: rpcRow.z_nr ?? zNr,
    data,
  };
}
