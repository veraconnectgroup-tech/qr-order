import { formatInTimeZone } from "date-fns-tz";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveFiscalBehavior } from "@/lib/fulfillment/resolve-fiscal-behavior";
import { buildFiscalSaleLines } from "@/lib/fiscal/runtime/build-fiscal-sale-lines";
import { ensureFiscalRegister } from "@/lib/fiscal/runtime/ensure-fiscal-register";
import { mapFiscalPaymentType } from "@/lib/fiscal/runtime/map-fiscal-payment-type";
import { resolveFiscalMoment } from "@/lib/fiscal/resolve-fiscal-moment";
import { logger } from "@/lib/logger";
import type { PosIntegrationContext } from "@/lib/outbox/types";

export type FiscalTrigger =
  | { kind: "payment_settled"; orderId: string; guestEmail?: string | null }
  | { kind: "cash_settled"; orderId: string; guestEmail?: string | null };

export type FiscalPipelineResult =
  | { skipped: true; reason: string }
  | { skipped: false; fiscalTransactionId: string | null; enqueued: boolean };

type OrderForFiscal = {
  id: string;
  location_id: string;
  payment_status: string;
  payment_method: string;
  status: string;
  total: number;
  tse_signature: string | null;
};

async function loadPosIntegration(
  admin: SupabaseClient,
  locationId: string
): Promise<PosIntegrationContext | null> {
  const { data } = await admin
    .from("pos_integrations")
    .select("id, provider, status")
    .eq("location_id", locationId)
    .eq("status", "connected")
    .maybeSingle();

  if (!data) return null;

  const row = data as {
    id: string;
    provider: string;
    status: PosIntegrationContext["status"];
  };

  return { id: row.id, provider: row.provider, status: row.status };
}

async function recordFiscalHandoff(
  admin: SupabaseClient,
  order: OrderForFiscal,
  orgId: string,
  posIntegration: PosIntegrationContext
): Promise<void> {
  const { error } = await admin.from("fiscal_handoffs").upsert(
    {
      order_id: order.id,
      location_id: order.location_id,
      org_id: orgId,
      pos_provider: posIntegration.provider,
    },
    { onConflict: "order_id" }
  );

  if (error) {
    logger.warn("fiscal_handoffs upsert failed", {
      orderId: order.id,
      error: error.message,
    });
  }
}

export async function runFiscalPipeline(
  admin: SupabaseClient,
  trigger: FiscalTrigger
): Promise<FiscalPipelineResult> {
  const orderId = trigger.orderId;

  const { data: orderRaw, error: orderError } = await admin
    .from("orders")
    .select(
      "id, location_id, payment_status, payment_method, status, total, tse_signature"
    )
    .eq("id", orderId)
    .single();

  if (orderError || !orderRaw) {
    return { skipped: true, reason: "order_not_found" };
  }

  const order = orderRaw as OrderForFiscal;

  const { data: location, error: locationError } = await admin
    .from("locations")
    .select("org_id, timezone")
    .eq("id", order.location_id)
    .single();

  if (locationError || !location) {
    return { skipped: true, reason: "location_not_found" };
  }

  const locationRow = location as { org_id: string; timezone: string };
  const posIntegration = await loadPosIntegration(admin, order.location_id);

  const moment = resolveFiscalMoment({
    paymentStatus: order.payment_status,
    paymentMethod: order.payment_method,
    status: order.status,
    posIntegration,
  });

  if (moment === "pos_fiscal_export") {
    if (posIntegration) {
      await recordFiscalHandoff(
        admin,
        order,
        locationRow.org_id,
        posIntegration
      );
    }
    return { skipped: true, reason: "vorsystem_handoff" };
  }

  if (moment === "never") {
    return { skipped: true, reason: "fiscal_moment_never" };
  }

  if (resolveFiscalBehavior(posIntegration) !== "standalone") {
    return { skipped: true, reason: "not_standalone" };
  }

  if (order.tse_signature) {
    return { skipped: true, reason: "already_signed_legacy" };
  }

  const register = await ensureFiscalRegister(
    admin,
    order.location_id,
    locationRow.org_id
  );

  if (!register) {
    return { skipped: true, reason: "register_not_provisioned" };
  }

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .select("currency")
    .eq("id", locationRow.org_id)
    .single();

  if (orgError || !org) {
    return { skipped: true, reason: "org_not_found" };
  }

  const { data: items, error: itemsError } = await admin
    .from("order_items")
    .select("product_name, quantity, total, tax_rate")
    .eq("order_id", orderId);

  if (itemsError) {
    throw new Error(`order_items load failed: ${itemsError.message}`);
  }

  const sale = buildFiscalSaleLines(
    (items ?? []) as Array<{
      product_name: string;
      quantity: number;
      total: number;
      tax_rate: number | null;
    }>
  );

  const timezone = locationRow.timezone || "Europe/Berlin";
  const businessDate = formatInTimeZone(new Date(), timezone, "yyyy-MM-dd");
  const guestEmail =
    typeof trigger.guestEmail === "string" && trigger.guestEmail.trim()
      ? trigger.guestEmail.trim()
      : null;

  const { data: fiscalTransactionId, error: rpcError } = await admin.rpc(
    "finalize_fiscal_sale",
    {
      p_order_id: orderId,
      p_register_id: register.id,
      p_idempotency_key: `sale:${orderId}`,
      p_org_id: locationRow.org_id,
      p_location_id: order.location_id,
      p_currency: (org as { currency: string }).currency ?? "EUR",
      p_gross_total: sale.gross_total,
      p_net_total: sale.net_total,
      p_tax_total: sale.tax_total,
      p_payment_method: order.payment_method,
      p_payment_type: mapFiscalPaymentType(order.payment_method),
      p_business_date: businessDate,
      p_lines: sale.lines,
      p_guest_email: guestEmail,
    }
  );

  if (rpcError) {
    throw new Error(`finalize_fiscal_sale failed: ${rpcError.message}`);
  }

  const txId =
    typeof fiscalTransactionId === "string" ? fiscalTransactionId : null;

  logger.info("Fiscal pipeline finalized sale", {
    orderId,
    fiscalTransactionId: txId,
    registerId: register.id,
  });

  return {
    skipped: false,
    fiscalTransactionId: txId,
    enqueued: Boolean(txId),
  };
}
