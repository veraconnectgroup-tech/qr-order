import type { SupabaseClient } from "@supabase/supabase-js";
import {
  signOrderTransaction,
  signOrderStornoTransaction,
  type TseSignatureResult,
} from "@/lib/fiscal/sign-transaction";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

function unixToIso(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString();
}

async function loadJournalSale(
  admin: SupabaseClient,
  fiscalTransactionId: string
) {
  const { data: tx, error: txError } = await admin
    .from("fiscal_transactions")
    .select(
      `
      id, register_id, org_id, location_id, order_id, status,
      gross_total, net_total, tax_total, payment_method,
      fiskaly_tx_id, tse_signature,
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
    order_id: string;
    status: string;
    payment_method: string;
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

  const { data: order, error: orderError } = await admin
    .from("orders")
    .select(
      "id, order_number, subtotal, tax_amount, total, payment_method, location_id, tse_signature"
    )
    .eq("id", row.order_id)
    .single();

  if (orderError || !order) {
    return null;
  }

  const orderRow = order as {
    id: string;
    order_number: number;
    subtotal: number;
    tax_amount: number;
    total: number;
    payment_method: string;
    location_id: string;
    tse_signature: string | null;
  };

  const { data: org } = await admin
    .from("organizations")
    .select("currency")
    .eq("id", row.org_id)
    .single();

  const { data: lines } = await admin
    .from("fiscal_transaction_lines")
    .select("gross, tax_rate")
    .eq("fiscal_transaction_id", fiscalTransactionId)
    .order("line_no", { ascending: true });

  return {
    tx: row,
    register,
    order: orderRow,
    currency: (org as { currency: string } | null)?.currency ?? "EUR",
    lines: (lines ?? []) as Array<{ gross: number; tax_rate: number }>,
  };
}

async function persistJournalSignResult(
  admin: SupabaseClient,
  fiscalTransactionId: string,
  orderId: string,
  result: TseSignatureResult,
  fiskalyTxId: string,
  register: { fiskaly_tss_id: string; fiskaly_client_id: string },
  paymentMethod: string
): Promise<void> {
  const tseData = {
    ...result,
    tx_id: fiskalyTxId,
    tss_id: register.fiskaly_tss_id,
    client_id: register.fiskaly_client_id,
    payment_method: paymentMethod,
  };

  const { error: journalError } = await admin
    .from("fiscal_transactions")
    .update({
      status: "signed",
      fiskaly_tx_id: fiskalyTxId,
      tse_signature: result.signature,
      tse_data: tseData as Json,
      signature_counter: result.signature_counter,
      tse_start: unixToIso(result.start_time),
      tse_end: unixToIso(result.end_time),
      signed_at: new Date().toISOString(),
    } as never)
    .eq("id", fiscalTransactionId)
    .in("status", ["pending", "signing"]);

  if (journalError) {
    throw new Error(`journal sign persist failed: ${journalError.message}`);
  }

  const { error: orderError } = await admin
    .from("orders")
    .update({
      tse_signature: result.signature,
      tse_data: tseData as Json,
    })
    .eq("id", orderId);

  if (orderError) {
    throw new Error(`order dual-write failed: ${orderError.message}`);
  }
}

export async function signFiscalJournalTransaction(
  fiscalTransactionId: string
): Promise<TseSignatureResult | null> {
  const admin = createAdminClient();
  const loaded = await loadJournalSale(admin, fiscalTransactionId);

  if (!loaded) {
    return null;
  }

  if (loaded.tx.status === "signed" || loaded.tx.tse_signature) {
    return null;
  }

  if (loaded.order.tse_signature) {
    return null;
  }

  await admin
    .from("fiscal_transactions")
    .update({ status: "signing" } as never)
    .eq("id", fiscalTransactionId)
    .eq("status", "pending");

  const result = await signOrderTransaction(admin, {
    id: loaded.order.id,
    organizationId: loaded.tx.org_id,
    locationId: loaded.order.location_id,
    order_number: loaded.order.order_number,
    subtotal: Number(loaded.order.subtotal),
    tax_amount: Number(loaded.order.tax_amount),
    total: Number(loaded.order.total),
    payment_method: loaded.order.payment_method,
    currency: loaded.currency,
    order_items: loaded.lines.map((line) => ({
      total: Number(line.gross),
      tax_rate: Number(line.tax_rate),
    })),
  });

  if (!result) {
    await admin
      .from("fiscal_transactions")
      .update({ status: "pending" } as never)
      .eq("id", fiscalTransactionId)
      .eq("status", "signing");
    return null;
  }

  const fiskalyTxId = result.tx_id ?? result.signature;

  await persistJournalSignResult(
    admin,
    fiscalTransactionId,
    loaded.order.id,
    result,
    fiskalyTxId,
    loaded.register,
    loaded.order.payment_method
  );

  return result;
}

async function loadJournalStorno(
  admin: SupabaseClient,
  fiscalTransactionId: string
) {
  const { data: tx, error: txError } = await admin
    .from("fiscal_transactions")
    .select(
      `
      id, register_id, org_id, location_id, order_id, status, storno_of_id,
      gross_total, payment_method, tse_signature,
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
    order_id: string;
    status: string;
    storno_of_id: string | null;
    gross_total: number;
    payment_method: string;
    tse_signature: string | null;
    fiscal_registers:
      | { fiskaly_tss_id: string; fiskaly_client_id: string }
      | { fiskaly_tss_id: string; fiskaly_client_id: string }[]
      | null;
  };

  if (!row.storno_of_id) {
    return null;
  }

  const register = Array.isArray(row.fiscal_registers)
    ? row.fiscal_registers[0]
    : row.fiscal_registers;

  if (!register) {
    return null;
  }

  const [{ data: order, error: orderError }, { data: parentSale }] =
    await Promise.all([
      admin
        .from("orders")
        .select(
          "id, order_number, subtotal, tax_amount, total, payment_method, location_id"
        )
        .eq("id", row.order_id)
        .single(),
      admin
        .from("fiscal_transactions")
        .select("fiskaly_tx_id")
        .eq("id", row.storno_of_id)
        .single(),
    ]);

  if (orderError || !order) {
    return null;
  }

  const orderRow = order as {
    id: string;
    order_number: number;
    subtotal: number;
    tax_amount: number;
    total: number;
    payment_method: string;
    location_id: string;
  };

  const { data: org } = await admin
    .from("organizations")
    .select("currency")
    .eq("id", row.org_id)
    .single();

  const { data: lines } = await admin
    .from("fiscal_transaction_lines")
    .select("gross, tax_rate")
    .eq("fiscal_transaction_id", fiscalTransactionId)
    .order("line_no", { ascending: true });

  const parentFiskalyTxId =
    (parentSale as { fiskaly_tx_id: string | null } | null)?.fiskaly_tx_id ??
    null;

  return {
    tx: row,
    register,
    order: orderRow,
    currency: (org as { currency: string } | null)?.currency ?? "EUR",
    lines: (lines ?? []) as Array<{ gross: number; tax_rate: number }>,
    parentFiskalyTxId,
  };
}

export async function signFiscalJournalStorno(
  fiscalTransactionId: string
): Promise<TseSignatureResult | null> {
  const admin = createAdminClient();
  const loaded = await loadJournalStorno(admin, fiscalTransactionId);

  if (!loaded) {
    return null;
  }

  if (loaded.tx.status === "signed" || loaded.tx.tse_signature) {
    return null;
  }

  await admin
    .from("fiscal_transactions")
    .update({ status: "signing" } as never)
    .eq("id", fiscalTransactionId)
    .eq("status", "pending");

  const stornoAmount = Number(loaded.tx.gross_total);

  const result = await signOrderStornoTransaction(
    admin,
    {
      id: loaded.order.id,
      organizationId: loaded.tx.org_id,
      locationId: loaded.order.location_id,
      order_number: loaded.order.order_number,
      subtotal: Number(loaded.order.subtotal),
      tax_amount: Number(loaded.order.tax_amount),
      total: Number(loaded.order.total),
      payment_method: loaded.order.payment_method,
      currency: loaded.currency,
      originalTseTxId: loaded.parentFiskalyTxId ?? undefined,
      order_items: loaded.lines.map((line) => ({
        total: Number(line.gross),
        tax_rate: Number(line.tax_rate),
      })),
    },
    stornoAmount
  );

  if (!result) {
    await admin
      .from("fiscal_transactions")
      .update({ status: "pending" } as never)
      .eq("id", fiscalTransactionId)
      .eq("status", "signing");
    return null;
  }

  const fiskalyTxId = result.tx_id ?? result.signature;

  await persistJournalSignResult(
    admin,
    fiscalTransactionId,
    loaded.order.id,
    result,
    fiskalyTxId,
    loaded.register,
    loaded.order.payment_method
  );

  return result;
}
