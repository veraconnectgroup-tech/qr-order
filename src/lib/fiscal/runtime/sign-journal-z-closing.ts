import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type FiskalyReceiptSchema,
  type FiskalyVatRate,
  getFiskalyClient,
  isFiskalyConfigured,
} from "@/lib/fiscal/fiskaly";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";
import type { TseSignatureResult } from "@/lib/fiscal/sign-transaction";
import {
  TseSigningDeferredError,
  withCircuitBreaker,
  isFiskalyDeferredSigningResult,
  logFiskalyCircuitDeferred,
  type FiskalyDeferredSigningResult,
} from "@/lib/resilience/circuit-breaker";
import { logger } from "@/lib/logger";
import type { FiskalyTransactionResponse } from "@/lib/fiscal/fiskaly";

type VatSummaryEntry = {
  rate: number;
  gross: number;
  net: number;
  tax: number;
};

function unixToIso(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString();
}

function mapVatRate(taxRate: number): FiskalyVatRate {
  if (taxRate === 7) return "REDUCED_1";
  if (taxRate === 0) return "NULL";
  return "NORMAL";
}

function formatFiskalyAmount(value: number): string {
  return value.toFixed(2);
}

function buildZClosingTseSchema(
  closing: {
    total_gross: number;
    total_cash: number;
    total_non_cash: number;
    vat_summary: VatSummaryEntry[];
  },
  currency: string
): FiskalyReceiptSchema {
  const vatRows = closing.vat_summary ?? [];
  const amounts_per_vat_rate =
    vatRows.length > 0
      ? vatRows.map((row) => ({
          vat_rate: mapVatRate(row.rate),
          amount: formatFiskalyAmount(row.gross),
        }))
      : [
          {
            vat_rate: "NORMAL" as FiskalyVatRate,
            amount: formatFiskalyAmount(Number(closing.total_gross)),
          },
        ];

  const amounts_per_payment_type: FiskalyReceiptSchema["standard_v1"]["receipt"]["amounts_per_payment_type"] =
    [];

  const cash = Number(closing.total_cash);
  const nonCash = Number(closing.total_non_cash);

  if (cash > 0) {
    amounts_per_payment_type.push({
      payment_type: "CASH",
      amount: formatFiskalyAmount(cash),
      currency_code: currency,
    });
  }
  if (nonCash > 0) {
    amounts_per_payment_type.push({
      payment_type: "NON_CASH",
      amount: formatFiskalyAmount(nonCash),
      currency_code: currency,
    });
  }
  if (amounts_per_payment_type.length === 0) {
    amounts_per_payment_type.push({
      payment_type: "NON_CASH",
      amount: formatFiskalyAmount(Number(closing.total_gross)),
      currency_code: currency,
    });
  }

  return {
    standard_v1: {
      receipt: {
        receipt_type: "RECEIPT",
        amounts_per_vat_rate,
        amounts_per_payment_type,
      },
    },
  };
}

async function loadJournalZClosing(admin: SupabaseClient, fiscalTransactionId: string) {
  const { data: tx, error: txError } = await admin
    .from("fiscal_transactions")
    .select(
      `
      id, register_id, org_id, location_id, status, business_date,
      gross_total, z_nr, tse_signature,
      fiscal_registers ( fiskaly_tss_id, fiskaly_client_id )
    `
    )
    .eq("id", fiscalTransactionId)
    .single();

  if (txError || !tx) {
    return null;
  }

  const row = tx as {
    id: string;
    org_id: string;
    location_id: string;
    status: string;
    business_date: string;
    gross_total: number;
    z_nr: number | null;
    tse_signature: string | null;
    fiscal_registers:
      | { fiskaly_tss_id: string; fiskaly_client_id: string }
      | { fiskaly_tss_id: string; fiskaly_client_id: string }[]
      | null;
  };

  const register = Array.isArray(row.fiscal_registers)
    ? row.fiscal_registers[0]
    : row.fiscal_registers;

  if (!register) {
    return null;
  }

  const { data: org } = await admin
    .from("organizations")
    .select("currency")
    .eq("id", row.org_id)
    .single();

  const { data: closingProjection } = await admin
    .from("daily_closings" as never)
    .select("total_cash, total_non_cash, vat_summary")
    .eq("location_id", row.location_id)
    .eq("business_date", row.business_date)
    .maybeSingle();

  const projection = closingProjection as {
    total_cash: number;
    total_non_cash: number;
    vat_summary: VatSummaryEntry[];
  } | null;

  const { data: lines } = await admin
    .from("fiscal_transaction_lines")
    .select("tax_rate, gross, net, tax")
    .eq("fiscal_transaction_id", fiscalTransactionId)
    .order("line_no", { ascending: true });

  const vatSummary: VatSummaryEntry[] =
    projection?.vat_summary ??
    ((lines ?? []) as Array<{
      tax_rate: number;
      gross: number;
      net: number;
      tax: number;
    }>).map((line) => ({
      rate: Number(line.tax_rate ?? 19),
      gross: Number(line.gross),
      net: Number(line.net),
      tax: Number(line.tax),
    }));

  const totalCash = projection?.total_cash ?? 0;
  const totalNonCash =
    projection?.total_non_cash ??
    Math.max(0, Number(row.gross_total) - Number(totalCash));

  return {
    tx: row,
    register,
    currency: (org as { currency: string } | null)?.currency ?? "EUR",
    closing: {
      total_gross: Number(row.gross_total),
      total_cash: Number(totalCash),
      total_non_cash: Number(totalNonCash),
      vat_summary: vatSummary,
    },
  };
}

export async function signFiscalJournalZClosing(
  fiscalTransactionId: string,
  closingTotals?: {
    total_cash: number;
    total_non_cash: number;
    vat_summary: VatSummaryEntry[];
  }
): Promise<TseSignatureResult | null> {
  if (!isFiskalyConfigured()) {
    return null;
  }

  const admin = createAdminClient();
  const loaded = await loadJournalZClosing(admin, fiscalTransactionId);

  if (!loaded) {
    return null;
  }

  if (loaded.tx.status === "signed" || loaded.tx.tse_signature) {
    return null;
  }

  const closingInput = closingTotals
    ? {
        total_gross: loaded.closing.total_gross,
        total_cash: closingTotals.total_cash,
        total_non_cash: closingTotals.total_non_cash,
        vat_summary: closingTotals.vat_summary,
      }
    : loaded.closing;

  await admin
    .from("fiscal_transactions")
    .update({ status: "signing" } as never)
    .eq("id", fiscalTransactionId)
    .eq("status", "pending");

  const schema = buildZClosingTseSchema(closingInput, loaded.currency);
  const client = getFiskalyClient();

  let tx;
  try {
    const result = await withCircuitBreaker<
      FiskalyTransactionResponse | FiskalyDeferredSigningResult
    >(
      "fiskaly",
      () =>
        client.createTransaction(loaded.register.fiskaly_tss_id, {
          tx_id: crypto.randomUUID(),
          client_id: loaded.register.fiskaly_client_id,
          schema,
          metadata: {
            fiscal_transaction_id: fiscalTransactionId,
            location_id: loaded.tx.location_id,
            business_date: loaded.tx.business_date,
            closing_type: "z_bon",
          },
        }),
      () => ({ signed: false as const, queued: true as const })
    );

    if (isFiskalyDeferredSigningResult(result)) {
      logFiskalyCircuitDeferred(fiscalTransactionId);
      throw new TseSigningDeferredError(fiscalTransactionId);
    }

    tx = result;
  } catch (error) {
    await admin
      .from("fiscal_transactions")
      .update({ status: "pending" } as never)
      .eq("id", fiscalTransactionId)
      .eq("status", "signing");
    throw error;
  }

  const signatureValue = tx.signature?.value ?? "";
  const counterRaw = tx.signature?.counter ?? tx.number;
  const signatureCounter =
    typeof counterRaw === "number" ? counterRaw : Number(counterRaw);

  const tseData = {
    tss_serial: tx.tss_serial_number ?? "",
    signature_counter: Number.isFinite(signatureCounter)
      ? signatureCounter
      : tx.number,
    signature: signatureValue,
    start_time: tx.time_start,
    end_time: tx.time_end ?? tx.time_start,
    qr_code_data: tx.qr_code_data ?? "",
    tx_id: tx._id,
    tss_id: loaded.register.fiskaly_tss_id,
    client_id: loaded.register.fiskaly_client_id,
  };

  const { error: journalError } = await admin
    .from("fiscal_transactions")
    .update({
      status: "signed",
      fiskaly_tx_id: tx._id,
      tse_signature: signatureValue,
      tse_data: tseData as Json,
      signature_counter: Number.isFinite(signatureCounter)
        ? signatureCounter
        : tx.number,
      tse_start: unixToIso(tx.time_start),
      tse_end: unixToIso(tx.time_end ?? tx.time_start),
      signed_at: new Date().toISOString(),
    } as never)
    .eq("id", fiscalTransactionId)
    .in("status", ["pending", "signing"]);

  if (journalError) {
    throw new Error(`z_closing journal sign persist failed: ${journalError.message}`);
  }

  const { error: closingError } = await admin
    .from("daily_closings" as never)
    .update({
      tse_closing_signature: signatureValue,
      tse_closing_data: tseData as unknown as Json,
      fiscal_transaction_id: fiscalTransactionId,
      z_nr: loaded.tx.z_nr,
    } as never)
    .eq("location_id", loaded.tx.location_id)
    .eq("business_date", loaded.tx.business_date);

  if (closingError) {
    logger.warn("daily_closings projection update after z_closing sign failed", {
      fiscalTransactionId,
      error: closingError.message,
    });
  }

  logger.info("Z-Bon journal TSE signed", {
    fiscalTransactionId,
    locationId: loaded.tx.location_id,
    businessDate: loaded.tx.business_date,
    zNr: loaded.tx.z_nr,
  });

  return {
    tss_serial: tseData.tss_serial,
    signature_counter: tseData.signature_counter,
    signature: signatureValue,
    start_time: tseData.start_time,
    end_time: tseData.end_time,
    qr_code_data: tseData.qr_code_data,
    tx_id: tx._id,
    tss_id: loaded.register.fiskaly_tss_id,
    client_id: loaded.register.fiskaly_client_id,
  };
}
