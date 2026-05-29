import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type FiskalyPaymentType,
  type FiskalyReceiptSchema,
  type FiskalyVatRate,
  type FiskalyTransactionResponse,
  getFiskalyClient,
  isFiskalyConfigured,
} from "@/lib/fiscal/fiskaly";
import { logger } from "@/lib/logger";
import {
  isFiskalyDeferredSigningResult,
  logFiskalyCircuitDeferred,
  TseSigningDeferredError,
  withCircuitBreaker,
  type FiskalyDeferredSigningResult,
} from "@/lib/resilience/circuit-breaker";
import { loadFiskalyConfigForSigning } from "@/lib/fiscal/runtime/load-fiskaly-config";
import { createAdminClient } from "@/lib/supabase/admin";

export type TseSignatureResult = {
  tss_serial: string;
  signature_counter: number;
  signature: string;
  start_time: number;
  end_time: number;
  qr_code_data: string;
  tx_id?: string;
  tss_id?: string;
  client_id?: string;
};

export type OrderForTseSigning = {
  id: string;
  organizationId: string;
  locationId?: string;
  order_number: number;
  subtotal: number;
  tax_amount: number;
  total: number;
  payment_method: string;
  currency?: string;
  order_items?: Array<{ total: number; tax_rate: number }>;
  /** Original Fiskaly tx_id from the paid order — required for DSFinV-K storno reference. */
  originalTseTxId?: string;
};

function formatFiskalyAmount(value: number): string {
  return value.toFixed(2);
}

export { formatFiskalyAmount };

function mapVatRate(taxRate: number): FiskalyVatRate {
  if (taxRate === 7) return "REDUCED_1";
  if (taxRate === 0) return "NULL";
  return "NORMAL";
}

function mapPaymentType(paymentMethod: string): FiskalyPaymentType {
  if (
    paymentMethod === "online" ||
    paymentMethod === "card_at_table" ||
    paymentMethod === "card_terminal"
  ) {
    return "NON_CASH";
  }
  return "CASH";
}

function buildReceiptSchema(
  order: OrderForTseSigning,
  receiptType: "RECEIPT" = "RECEIPT",
  amountOverride?: number,
  isStorno = false
): FiskalyReceiptSchema {
  const currency = order.currency ?? "EUR";
  const items = order.order_items ?? [];
  const grossTotal = amountOverride ?? Number(order.total);
  const signed = (amount: number) => (isStorno ? amount * -1 : amount);

  const grossByRate = new Map<number, number>();
  for (const item of items) {
    const rate = Number(item.tax_rate ?? 19);
    grossByRate.set(rate, (grossByRate.get(rate) ?? 0) + Number(item.total));
  }

  if (grossByRate.size === 0) {
    const fallbackRate =
      order.tax_amount > 0 && order.subtotal > 0
        ? Math.round((order.tax_amount / order.subtotal) * 100)
        : 19;
    grossByRate.set(fallbackRate === 7 ? 7 : 19, grossTotal);
  } else if (amountOverride != null && Number(order.total) > 0) {
    const ratio = grossTotal / Number(order.total);
    for (const [rate, amount] of [...grossByRate.entries()]) {
      grossByRate.set(rate, amount * ratio);
    }
  }

  const amounts_per_vat_rate = [...grossByRate.entries()].map(
    ([rate, amount]) => ({
      vat_rate: mapVatRate(rate),
      amount: formatFiskalyAmount(signed(amount)),
    })
  );

  return {
    standard_v1: {
      receipt: {
        receipt_type: receiptType,
        amounts_per_vat_rate,
        amounts_per_payment_type: [
          {
            payment_type: mapPaymentType(order.payment_method),
            amount: formatFiskalyAmount(signed(grossTotal)),
            currency_code: currency,
          },
        ],
      },
    },
  };
}

function toSignatureResult(
  tx: Awaited<
    ReturnType<ReturnType<typeof getFiskalyClient>["createTransaction"]>
  >
): TseSignatureResult {
  const signatureValue = tx.signature?.value ?? "";
  const counterRaw = tx.signature?.counter ?? tx.number;
  const signatureCounter =
    typeof counterRaw === "number" ? counterRaw : Number(counterRaw);

  return {
    tss_serial: tx.tss_serial_number ?? "",
    signature_counter: Number.isFinite(signatureCounter)
      ? signatureCounter
      : tx.number,
    signature: signatureValue,
    start_time: tx.time_start,
    end_time: tx.time_end ?? tx.time_start,
    qr_code_data: tx.qr_code_data ?? "",
  };
}

async function createFiskalyTransaction(
  tssId: string,
  data: Parameters<ReturnType<typeof getFiskalyClient>["createTransaction"]>[1],
  orderId: string
): Promise<FiskalyTransactionResponse> {
  const client = getFiskalyClient();
  const result = await withCircuitBreaker<
    FiskalyTransactionResponse | FiskalyDeferredSigningResult
  >(
    "fiskaly",
    () => client.createTransaction(tssId, data),
    () => ({ signed: false as const, queued: true as const })
  );

  if (isFiskalyDeferredSigningResult(result)) {
    logFiskalyCircuitDeferred(orderId);
    throw new TseSigningDeferredError(orderId);
  }

  return result;
}

export async function signOrderTransaction(
  admin: SupabaseClient,
  order: OrderForTseSigning
): Promise<TseSignatureResult | null> {
  if (!isFiskalyConfigured()) {
    return null;
  }

  const fiskalyConfig = await loadFiskalyConfigForSigning(
    admin,
    order.organizationId,
    order.locationId
  );
  if (!fiskalyConfig) {
    return null;
  }

  const schema = buildReceiptSchema(order);

  const tx = await createFiskalyTransaction(
    fiskalyConfig.fiskaly_tss_id,
    {
      tx_id: crypto.randomUUID(),
      client_id: fiskalyConfig.fiskaly_client_id,
      schema,
      metadata: {
        order_id: order.id,
        order_number: String(order.order_number),
        organization_id: order.organizationId,
      },
    },
    order.id
  );

  const result = toSignatureResult(tx);

  const { error } = await admin
    .from("orders")
    .update({
      tse_signature: result.signature,
      tse_data: {
        ...result,
        tx_id: tx._id,
        tss_id: fiskalyConfig.fiskaly_tss_id,
        client_id: fiskalyConfig.fiskaly_client_id,
        payment_method: order.payment_method,
      },
    })
    .eq("id", order.id);

  if (error) {
    throw new Error(`TSE data could not be saved: ${error.message}`);
  }

  logger.info("TSE transaction signed", {
    orderId: order.id,
    orderNumber: order.order_number,
    tssSerial: result.tss_serial,
  });

  return {
    ...result,
    tx_id: tx._id,
    tss_id: fiskalyConfig.fiskaly_tss_id,
    client_id: fiskalyConfig.fiskaly_client_id,
  };
}

export async function signOrderStornoTransaction(
  admin: SupabaseClient,
  order: OrderForTseSigning,
  refundAmount?: number
): Promise<TseSignatureResult | null> {
  if (!isFiskalyConfigured()) {
    return null;
  }

  const fiskalyConfig = await loadFiskalyConfigForSigning(
    admin,
    order.organizationId,
    order.locationId
  );
  if (!fiskalyConfig) {
    return null;
  }

  const schema = buildReceiptSchema(
    order,
    "RECEIPT",
    refundAmount ?? Number(order.total),
    true
  );

  const metadata: Record<string, string> = {
    order_id: order.id,
    order_number: String(order.order_number),
    organization_id: order.organizationId,
    storno: "true",
  };
  if (order.originalTseTxId) {
    metadata.original_tse_tx_id = order.originalTseTxId;
  }

  const tx = await createFiskalyTransaction(
    fiskalyConfig.fiskaly_tss_id,
    {
      tx_id: crypto.randomUUID(),
      client_id: fiskalyConfig.fiskaly_client_id,
      schema,
      metadata,
    },
    order.id
  );

  const result = toSignatureResult(tx);

  logger.info("TSE storno transaction signed", {
    orderId: order.id,
    orderNumber: order.order_number,
    tssSerial: result.tss_serial,
    refundAmount: refundAmount ?? order.total,
  });

  return {
    ...result,
    tx_id: tx._id,
    tss_id: fiskalyConfig.fiskaly_tss_id,
    client_id: fiskalyConfig.fiskaly_client_id,
  };
}

export async function signOrderTransactionById(
  orderId: string
): Promise<TseSignatureResult | null> {
  const admin = createAdminClient();

  const { data: order, error: orderError } = await admin
    .from("orders")
    .select(
      "id, order_number, subtotal, tax_amount, total, payment_method, location_id, tse_signature"
    )
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    return null;
  }

  const row = order as {
    id: string;
    order_number: number;
    subtotal: number;
    tax_amount: number;
    total: number;
    payment_method: string;
    location_id: string;
    tse_signature: string | null;
  };

  if (row.tse_signature) {
    return null;
  }

  const { data: location, error: locationError } = await admin
    .from("locations")
    .select("org_id")
    .eq("id", row.location_id)
    .single();

  if (locationError || !location) {
    return null;
  }

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .select("currency")
    .eq("id", (location as { org_id: string }).org_id)
    .single();

  if (orgError || !org) {
    return null;
  }

  const { data: items } = await admin
    .from("order_items")
    .select("total, tax_rate")
    .eq("order_id", orderId);

  return signOrderTransaction(admin, {
    id: row.id,
    organizationId: (location as { org_id: string }).org_id,
    locationId: row.location_id,
    order_number: row.order_number,
    subtotal: Number(row.subtotal),
    tax_amount: Number(row.tax_amount),
    total: Number(row.total),
    payment_method: row.payment_method,
    currency: (org as { currency: string }).currency,
    order_items: ((items ?? []) as Array<{ total: number; tax_rate: number }>).map(
      (item) => ({
        total: Number(item.total),
        tax_rate: Number(item.tax_rate),
      })
    ),
  });
}
