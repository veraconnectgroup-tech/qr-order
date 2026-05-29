import { createAdminClient } from "@/lib/supabase/admin";
import { signOrderStornoTransaction } from "@/lib/fiscal/sign-transaction";
import { logger } from "@/lib/logger";
import { processRefund } from "@/lib/stripe/refund";
import type { Json } from "@/types/database";

/** System actor for webhook/POS storno when no staff UUID is available. */
export const FISCAL_STORNO_SYSTEM_ACTOR =
  "00000000-0000-0000-0000-000000000099";

export type StornoRequest = {
  orderId: string;
  reason: string;
  performedBy: string;
  amount?: number;
  /** Set when Stripe refund already completed (e.g. dashboard webhook sync). */
  skipStripeRefund?: boolean;
  stripeRefundId?: string | null;
};

export type StornoResult =
  | { ok: true; stornoId: string; tseSignature: string | null }
  | { error: string; code: number };

const VALID_STORNO_STATUSES = [
  "accepted",
  "preparing",
  "ready",
  "delivered",
] as const;

const REFUNDABLE_STRIPE_METHODS = new Set([
  "online",
  "card_terminal",
  "pos_online",
]);

type StornoOrderRow = {
  id: string;
  order_number: number;
  status: string;
  total: number;
  subtotal: number;
  tax_amount: number;
  payment_method: string;
  payment_status: string;
  tse_signature: string | null;
  tse_data: unknown;
  location_id: string;
  stripe_payment_intent_id: string | null;
  has_storno: boolean;
  storno_total: number;
  created_at: string;
  order_items: Array<{ total: number; tax_rate: number | null }>;
};

type OrderTseData = {
  tx_id?: string;
};

export type PreparedStorno = {
  order: StornoOrderRow;
  stornoAmount: number;
  stornoType: "full" | "partial";
  alreadyStornoed: number;
  maxStornoable: number;
};

function isStornoResult(
  value: PreparedStorno | StornoResult
): value is StornoResult {
  return "error" in value;
}

export async function prepareStorno(
  req: StornoRequest
): Promise<PreparedStorno | StornoResult> {
  const admin = createAdminClient();

  const { data: order, error: orderError } = await admin
    .from("orders")
    .select(
      `
      id, order_number, status, total, subtotal,
      tax_amount, payment_method, payment_status,
      tse_signature, tse_data, location_id,
      stripe_payment_intent_id, has_storno, storno_total, created_at,
      order_items(total, tax_rate)
    `
    )
    .eq("id", req.orderId)
    .single();

  if (orderError || !order) {
    return { error: "Order not found", code: 404 };
  }

  const row = order as unknown as StornoOrderRow;

  if (!row.tse_signature) {
    return {
      error: "Order has no TSE signature — use reject instead",
      code: 400,
    };
  }

  if (
    !VALID_STORNO_STATUSES.includes(
      row.status as (typeof VALID_STORNO_STATUSES)[number]
    )
  ) {
    return {
      error: `Cannot storno order in status: ${row.status}`,
      code: 409,
    };
  }

  const orderTotal = Number(row.total);
  const alreadyStornoed = Number(row.storno_total) || 0;
  const maxStornoable = orderTotal - alreadyStornoed;
  const stornoAmount = req.amount
    ? Math.min(req.amount, maxStornoable)
    : maxStornoable;

  if (stornoAmount <= 0) {
    return { error: "Nothing left to storno", code: 400 };
  }

  const isFullStorno = stornoAmount >= maxStornoable - 0.01;
  const stornoType = isFullStorno ? "full" : "partial";

  return {
    order: row,
    stornoAmount,
    stornoType,
    alreadyStornoed,
    maxStornoable,
  };
}

export async function performStorno(
  req: StornoRequest
): Promise<StornoResult> {
  const prepared = await prepareStorno(req);
  if (isStornoResult(prepared)) {
    return prepared;
  }

  const admin = createAdminClient();
  const { order, stornoAmount, stornoType, alreadyStornoed } = prepared;
  const orderTotal = Number(order.total);

  logger.info("Storno prepared", {
    orderId: req.orderId,
    stornoAmount,
    stornoType,
    performedBy: req.performedBy,
  });

  const { data: loc, error: locError } = await admin
    .from("locations")
    .select("org_id")
    .eq("id", order.location_id)
    .single();

  if (locError || !loc) {
    return { error: "Location not found", code: 404 };
  }

  const orgId = (loc as { org_id: string }).org_id;

  const { data: org } = await admin
    .from("organizations")
    .select("currency")
    .eq("id", orgId)
    .single();

  const originalTseData = order.tse_data as OrderTseData | null;
  const originalTseTxId = originalTseData?.tx_id ?? null;

  const tseResult = await signOrderStornoTransaction(
    admin,
    {
      id: order.id,
      organizationId: orgId,
      order_number: order.order_number,
      subtotal: Number(order.subtotal),
      tax_amount: Number(order.tax_amount),
      total: Number(order.total),
      payment_method: order.payment_method,
      currency: (org as { currency: string } | null)?.currency,
      originalTseTxId: originalTseTxId ?? undefined,
      order_items: (order.order_items ?? []).map((item) => ({
        total: Number(item.total),
        tax_rate: Number(item.tax_rate ?? 19),
      })),
    },
    stornoAmount
  );

  const { data: stornoRecord, error: insertErr } = await admin
    .from("storno_records")
    .insert({
      org_id: orgId,
      location_id: order.location_id,
      original_order_id: order.id,
      storno_amount: stornoAmount,
      storno_reason: req.reason,
      storno_type: stornoType,
      performed_by: req.performedBy,
      tse_storno_signature: tseResult?.signature ?? null,
      tse_storno_data: (tseResult ?? null) as Json | null,
      tse_storno_tx_id: tseResult?.tx_id ?? null,
      original_tse_tx_id: originalTseTxId,
      original_tse_signature: order.tse_signature,
      refund_status: "tse_signed",
    })
    .select("id")
    .single();

  if (insertErr || !stornoRecord) {
    logger.error("Storno record insert failed", {
      orderId: order.id,
      error: insertErr?.message,
    });
    return { error: "Storno record failed", code: 500 };
  }

  const stornoId = (stornoRecord as { id: string }).id;

  await admin
    .from("orders")
    .update({
      has_storno: true,
      storno_total: alreadyStornoed + stornoAmount,
    })
    .eq("id", order.id);

  if (req.skipStripeRefund) {
    if (req.stripeRefundId) {
      await admin
        .from("storno_records")
        .update({
          stripe_refund_id: req.stripeRefundId,
          refund_status: "refunded",
        })
        .eq("id", stornoId);
    }
  } else if (
    REFUNDABLE_STRIPE_METHODS.has(order.payment_method) &&
    order.stripe_payment_intent_id &&
    (order.payment_status === "paid" || order.payment_status === "partial_refund")
  ) {
    const refundResult = await processRefund(
      {
        id: order.id,
        location_id: order.location_id,
        payment_status: order.payment_status,
        payment_method: order.payment_method,
        stripe_payment_intent_id: order.stripe_payment_intent_id,
        total: orderTotal,
        created_at: order.created_at,
        tse_signature: order.tse_signature,
      },
      req.performedBy,
      req.reason,
      {
        amount: stornoAmount,
        skipWindowCheck: true,
      }
    );

    if ("ok" in refundResult) {
      await admin
        .from("storno_records")
        .update({
          stripe_refund_id: refundResult.refundId,
          refund_status: "refunded",
        })
        .eq("id", stornoId);
    }
  }

  await admin.from("order_events").insert({
    order_id: order.id,
    event_type: "storno",
    payload: {
      storno_id: stornoId,
      amount: stornoAmount,
      type: stornoType,
      reason: req.reason,
    },
    actor_type: "staff",
    actor_id: req.performedBy,
  });

  logger.info("Order storno completed", {
    orderId: order.id,
    stornoId,
    amount: stornoAmount,
    type: stornoType,
  });

  return {
    ok: true,
    stornoId,
    tseSignature: tseResult?.signature ?? null,
  };
}

/** Idempotent TSE storno when refund was processed outside performStorno (Stripe webhook). */
export async function syncStornoForExternalRefund(
  req: StornoRequest
): Promise<StornoResult | { skipped: true }> {
  const result = await performStorno({
    ...req,
    skipStripeRefund: true,
  });

  if ("error" in result && result.error === "Nothing left to storno") {
    return { skipped: true };
  }

  return result;
}
