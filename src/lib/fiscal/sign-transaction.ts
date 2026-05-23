import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type FiskalyPaymentType,
  type FiskalyReceiptSchema,
  type FiskalyVatRate,
  getFiskalyClient,
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
  organizationId: string;
  order_number: number;
  subtotal: number;
  tax_amount: number;
  total: number;
  payment_method: string;
  currency?: string;
  order_items?: Array<{ total: number; tax_rate: number }>;
};

type OrgFiskalyConfig = {
  fiskaly_tss_id: string;
  fiskaly_client_id: string;
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
    const fallbackRate =
      order.tax_amount > 0 && order.subtotal > 0
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
    signature_counter: Number.isFinite(signatureCounter)
      ? signatureCounter
      : tx.number,
    signature: signatureValue,
    start_time: tx.time_start,
    end_time: tx.time_end ?? tx.time_start,
    qr_code_data: tx.qr_code_data ?? "",
  };
}

async function loadOrgFiskalyConfig(
  admin: SupabaseClient,
  organizationId: string
): Promise<OrgFiskalyConfig | null> {
  const { data, error } = await admin
    .from("organizations")
    .select("fiskaly_tss_id, fiskaly_client_id")
    .eq("id", organizationId)
    .single();

  if (error || !data) {
    return null;
  }

  const row = data as {
    fiskaly_tss_id: string | null;
    fiskaly_client_id: string | null;
  };

  if (!row.fiskaly_tss_id || !row.fiskaly_client_id) {
    return null;
  }

  return {
    fiskaly_tss_id: row.fiskaly_tss_id,
    fiskaly_client_id: row.fiskaly_client_id,
  };
}

export async function signOrderTransaction(
  admin: SupabaseClient,
  order: OrderForTseSigning
): Promise<TseSignatureResult | null> {
  if (!isFiskalyConfigured()) {
    return null;
  }

  const orgFiskaly = await loadOrgFiskalyConfig(admin, order.organizationId);
  if (!orgFiskaly) {
    return null;
  }

  const client = getFiskalyClient();
  const schema = buildReceiptSchema(order);

  const tx = await client.createTransaction(orgFiskaly.fiskaly_tss_id, {
    tx_id: crypto.randomUUID(),
    client_id: orgFiskaly.fiskaly_client_id,
    schema,
    metadata: {
      order_id: order.id,
      order_number: String(order.order_number),
      organization_id: order.organizationId,
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
        tss_id: orgFiskaly.fiskaly_tss_id,
        client_id: orgFiskaly.fiskaly_client_id,
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
