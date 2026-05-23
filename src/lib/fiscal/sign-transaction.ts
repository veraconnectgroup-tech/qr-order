import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type FiskalyPaymentType,
  type FiskalyReceiptSchema,
  type FiskalyVatRate,
  getFiskalyClient,
  getFiskalyTssId,
  isFiskalyConfigured,
} from "@/lib/fiscal/fiskaly";

export type TseSignatureResult = {
  tss_serial: string;
  signature_counter: number;
  signature: string;
  start_time: number;
  end_time: number;
  qr_code_data: string;
};

export type OrderForTseSigning = {
  id: string;
  order_number: number;
  subtotal: number;
  tax_amount: number;
  total: number;
  payment_method: string;
  currency?: string;
  order_items?: Array<{ total: number; tax_rate: number }>;
};

function formatFiskalyAmount(value: number): string {
  return value.toFixed(2);
}

function mapVatRate(taxRate: number): FiskalyVatRate {
  if (taxRate === 7) return "REDUCED_1";
  if (taxRate === 0) return "NULL";
  return "NORMAL";
}

function mapPaymentType(paymentMethod: string): FiskalyPaymentType {
  if (paymentMethod === "online" || paymentMethod === "card_at_table") {
    return "NON_CASH";
  }
  return "CASH";
}

function buildReceiptSchema(order: OrderForTseSigning): FiskalyReceiptSchema {
  const currency = order.currency ?? "EUR";
  const items = order.order_items ?? [];

  const grossByRate = new Map<number, number>();
  for (const item of items) {
    const rate = Number(item.tax_rate ?? 19);
    grossByRate.set(rate, (grossByRate.get(rate) ?? 0) + Number(item.total));
  }

  if (grossByRate.size === 0) {
    const fallbackRate = order.tax_amount > 0 && order.subtotal > 0
      ? Math.round((order.tax_amount / order.subtotal) * 100)
      : 19;
    grossByRate.set(fallbackRate === 7 ? 7 : 19, Number(order.total));
  }

  const amounts_per_vat_rate = [...grossByRate.entries()].map(
    ([rate, amount]) => ({
      vat_rate: mapVatRate(rate),
      amount: formatFiskalyAmount(amount),
    })
  );

  return {
    standard_v1: {
      receipt: {
        receipt_type: "RECEIPT",
        amounts_per_vat_rate,
        amounts_per_payment_type: [
          {
            payment_type: mapPaymentType(order.payment_method),
            amount: formatFiskalyAmount(Number(order.total)),
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
    signature_counter: Number.isFinite(signatureCounter) ? signatureCounter : tx.number,
    signature: signatureValue,
    start_time: tx.time_start,
    end_time: tx.time_end ?? tx.time_start,
    qr_code_data: tx.qr_code_data ?? "",
  };
}

export async function signOrderTransaction(
  admin: SupabaseClient,
  order: OrderForTseSigning
): Promise<TseSignatureResult | null> {
  if (!isFiskalyConfigured()) {
    return null;
  }

  const tssId = getFiskalyTssId();
  if (!tssId) {
    return null;
  }

  const client = getFiskalyClient();
  const fiskalyClientId = await client.resolveClientId(tssId);
  const schema = buildReceiptSchema(order);

  const tx = await client.createTransaction(tssId, {
    tx_id: crypto.randomUUID(),
    client_id: fiskalyClientId,
    schema,
    metadata: {
      order_id: order.id,
      order_number: String(order.order_number),
    },
  });

  const result = toSignatureResult(tx);

  const { error } = await admin
    .from("orders")
    .update({
      tse_signature: result.signature,
      tse_data: {
        ...result,
        tx_id: tx._id,
        tss_id: tssId,
        client_id: fiskalyClientId,
        payment_method: order.payment_method,
      },
    })
    .eq("id", order.id);

  if (error) {
    throw new Error(`TSE data could not be saved: ${error.message}`);
  }

  return result;
}

export function scheduleOrderTseSign(
  admin: SupabaseClient,
  order: OrderForTseSigning
) {
  void signOrderTransaction(admin, order).catch((err) => {
    console.error("[fiskaly] TSE signing failed for order", order.id, err);
  });
}
