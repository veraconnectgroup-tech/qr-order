export const maxDuration = 15;

import { z } from "zod";
import { safeJsonParse } from "@/lib/api/safe-json";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { validateTableSession } from "@/lib/orders/validate-table-session";
import { withRateLimit } from "@/lib/rate-limit";
import { zSessionToken, zTableToken } from "@/lib/security/zod-fields";
import {
  getAvailablePaymentMethods,
  type SelectablePaymentMethod,
} from "@/lib/payment-methods";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";
import { calcPlatformFee } from "@/lib/stripe/connect";
import { buildPaymentIdempotencyKey } from "@/lib/resilience/idempotency";
import {
  handleStripeCircuitError,
  withStripeCircuit,
} from "@/lib/stripe/with-stripe-circuit";
import {
  clampTipAmount,
  distributeTipAcrossOrders,
} from "@/lib/orders/tips";

export const GET = withErrorHandler("sessions-bill-get", async (req, _ctx) => {
  const limited = await withRateLimit(req, "bill");
  if (limited) return limited;

    const sessionToken = req.nextUrl.searchParams.get("sessionToken");
    if (!sessionToken) {
      return apiError("Unauthorized.", 401);
    }

    const tableToken = req.nextUrl.searchParams.get("tableToken");
    if (!tableToken) {
      return apiError("Invalid table.", 400);
    }

    const sessionParsed = zSessionToken().safeParse(sessionToken ?? "");
    if (!sessionParsed.success) {
      return apiError("Unauthorized.", 401);
    }

    const tableParsed = zTableToken().safeParse(tableToken ?? "");
    if (!tableParsed.success) {
      return apiError("Invalid table.", 400);
    }

    const admin = createAdminClient();
    const sessionResult = await validateTableSession(
      admin,
      tableParsed.data,
      sessionParsed.data
    );

    if ("error" in sessionResult) {
      return apiError(sessionResult.error, sessionResult.status);
    }

    const { session } = sessionResult.data;

    const { data: orders } = await admin
      .from("orders")
      .select(
        "id, order_number, status, payment_status, payment_method, subtotal, tax_amount, total, tip_amount, created_at"
      )
      .eq("session_id", session.id)
      .not("status", "in", '("rejected","cancelled")')
      .order("created_at", { ascending: true });

    const rows =
      (orders as Array<{
        id: string;
        order_number: number;
        status: string;
        payment_status: string;
        payment_method: string;
        subtotal: number;
        tax_amount: number;
        total: number;
        tip_amount: number;
        created_at: string;
      }>) ?? [];

    const unpaid = rows.filter((o) => o.payment_status !== "paid");
    const amountDue = unpaid.reduce((sum, o) => sum + Number(o.total), 0);
    const tipAmount = unpaid.reduce(
      (sum, o) => sum + Number(o.tip_amount ?? 0),
      0
    );
    const subtotal = unpaid.reduce((sum, o) => sum + Number(o.subtotal), 0);
    const taxAmount = unpaid.reduce((sum, o) => sum + Number(o.tax_amount), 0);
    const chargeTotal = amountDue + tipAmount;

    return apiSuccess({
      orders: rows,
      unpaidOrderIds: unpaid.map((o) => o.id),
      amountDue,
      tipAmount,
      chargeTotal,
      subtotal,
      taxAmount,
      orderCount: rows.length,
      unpaidCount: unpaid.length,
    });
});

const checkoutSchema = z.object({
  sessionToken: zSessionToken(),
  tableToken: zTableToken(),
  paymentMethod: z.enum(["online", "at_bar", "card_at_table"]),
  tipAmount: z.number().min(0).max(500).optional().default(0),
});

async function loadPaymentOptions(locationId: string) {
  const admin = createAdminClient();
  const { data: location } = await admin
    .from("locations")
    .select(
      "payment_online_enabled, payment_at_bar_enabled, payment_card_at_table_enabled, org_id"
    )
    .eq("id", locationId)
    .single();

  if (!location) return null;

  const loc = location as {
    payment_online_enabled: boolean;
    payment_at_bar_enabled: boolean;
    payment_card_at_table_enabled: boolean;
    org_id: string;
  };

  const { data: org } = await admin
    .from("organizations")
    .select("stripe_onboarded")
    .eq("id", loc.org_id)
    .single();

  return getAvailablePaymentMethods({
    stripeOnboarded: Boolean(
      (org as { stripe_onboarded: boolean } | null)?.stripe_onboarded
    ),
    stripePublishableKey: Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY),
    paymentOnlineEnabled: loc.payment_online_enabled,
    paymentAtBarEnabled: loc.payment_at_bar_enabled,
    paymentCardAtTableEnabled: loc.payment_card_at_table_enabled,
  });
}

export const POST = withErrorHandler(
  "sessions-bill-post",
  async (req, _ctx) => {
    const limited = await withRateLimit(req, "bill");
    if (limited) return limited;

    const body = await safeJsonParse(req);
    if (!body) {
      return apiError("Invalid JSON.", 400);
    }

    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid input.", 400);
    }

    const admin = createAdminClient();
    const { sessionToken, tableToken, paymentMethod, tipAmount: requestedTip } =
      parsed.data;

    const sessionResult = await validateTableSession(
      admin,
      tableToken,
      sessionToken
    );

    if ("error" in sessionResult) {
      return apiError(sessionResult.error, sessionResult.status);
    }

    const { session, table } = sessionResult.data;

    const { data: orders } = await admin
      .from("orders")
      .select("id, total, tip_amount, location_id, stripe_payment_intent_id, payment_status, is_split")
      .eq("session_id", session.id)
      .neq("payment_status", "paid")
      .not("status", "in", '("rejected","cancelled")');

    const unpaidOrders =
      (orders as Array<{
        id: string;
        total: number;
        tip_amount: number;
        location_id: string;
        stripe_payment_intent_id: string | null;
        payment_status: string;
        is_split: boolean;
      }>) ?? [];

    if (unpaidOrders.length === 0) {
      return apiError("Nothing to pay.", 400);
    }

    if (unpaidOrders.some((o) => o.is_split)) {
      return apiError(
        "This bill is being split. Pay your share on the split screen.",
        400
      );
    }

    const locationId = unpaidOrders[0].location_id;
    const methods = await loadPaymentOptions(locationId);
    if (!methods?.includes(paymentMethod as SelectablePaymentMethod)) {
      return apiError("This payment method is not available.", 400);
    }

    const orderIds = unpaidOrders.map((o) => o.id);
    const sessionTotal = unpaidOrders.reduce(
      (sum, o) => sum + Number(o.total),
      0
    );

    const tipAmount = clampTipAmount(requestedTip, sessionTotal);
    const tipStaffId = table.assigned_staff_id ?? null;
    const tipDistribution = distributeTipAcrossOrders(
      unpaidOrders.map((o) => ({ id: o.id, total: Number(o.total) })),
      tipAmount
    );

    for (const { id, tip_amount } of tipDistribution) {
      const { error: tipError } = await admin
        .from("orders")
        .update({ tip_amount, tip_staff_id: tipStaffId })
        .eq("id", id);

      if (tipError) {
        return apiError(tipError.message, 500);
      }
    }

    const chargeTotal = sessionTotal + tipAmount;

    if (paymentMethod !== "online") {
      const now = new Date().toISOString();

      const { error } = await admin
        .from("orders")
        .update({
          payment_method: paymentMethod,
          payment_requested_at: now,
        })
        .in("id", orderIds);

      if (error) {
        return apiError(error.message, 500);
      }

      return apiSuccess({
        ok: true,
        orderIds,
        paymentMethod,
      });
    }

    const existingPiId = unpaidOrders.find(
      (o) => o.stripe_payment_intent_id
    )?.stripe_payment_intent_id;

    const { data: location } = await admin
      .from("locations")
      .select("org_id")
      .eq("id", locationId)
      .single();

    const { data: orgData } = await admin
      .from("organizations")
      .select(
        "stripe_account_id, platform_fee_percent, platform_fee_fixed, currency, stripe_onboarded"
      )
      .eq("id", (location as { org_id: string }).org_id)
      .single();

    const org = orgData as {
      stripe_account_id: string | null;
      platform_fee_percent: number;
      platform_fee_fixed: number;
      currency: string;
      stripe_onboarded: boolean;
    };

    if (!org.stripe_onboarded || !org.stripe_account_id) {
      return apiError("Online payments are not available.", 400);
    }

    const stripe = getStripe();

    const { data: locked, error: lockErr } = await admin
      .from("orders")
      .update({ payment_status: "processing" })
      .in("id", orderIds)
      .eq("payment_status", "pending")
      .select("id");

    if (lockErr) {
      return apiError(lockErr.message, 500);
    }

    if (!locked || locked.length === 0 || locked.length !== orderIds.length) {
      return apiError("Payment already in progress.", 409);
    }

    async function revertPaymentLock() {
      await admin
        .from("orders")
        .update({ payment_status: "pending" })
        .in("id", orderIds)
        .eq("payment_status", "processing");
    }

    try {
      if (existingPiId) {
        const existing = await withStripeCircuit(() =>
          stripe.paymentIntents.retrieve(
            existingPiId,
            {},
            { stripeAccount: org.stripe_account_id! }
          )
        );
        if (
          existing.client_secret &&
          existing.amount === Math.round(chargeTotal * 100)
        ) {
          await admin
            .from("orders")
            .update({
              payment_method: "online",
              payment_requested_at: new Date().toISOString(),
            })
            .in("id", orderIds);

          return apiSuccess({
            clientSecret: existing.client_secret,
            stripeAccountId: org.stripe_account_id,
            orderIds,
            tipAmount,
            chargeTotal,
          });
        }
      }

      const amountCents = Math.round(chargeTotal * 100);
      const applicationFee = calcPlatformFee(sessionTotal, {
        feePercent: org.platform_fee_percent,
        feeFixed: org.platform_fee_fixed,
      });

      const intent = await withStripeCircuit(() =>
        stripe.paymentIntents.create(
          {
            amount: amountCents,
            currency: (org.currency ?? "eur").toLowerCase(),
            automatic_payment_methods: { enabled: true },
            application_fee_amount: applicationFee,
            metadata: {
              order_id: orderIds[0],
              order_ids: orderIds.join(","),
              session_id: session.id,
              tip_amount: String(tipAmount),
            },
          },
          {
            stripeAccount: org.stripe_account_id!,
            idempotencyKey: buildPaymentIdempotencyKey(
              (location as { org_id: string }).org_id,
              orderIds[0],
              amountCents
            ),
          }
        )
      );

      if (!intent.client_secret) {
        await revertPaymentLock();
        return apiError("Payment could not be started.", 500);
      }

      await admin
        .from("orders")
        .update({
          payment_method: "online",
          payment_status: "processing",
          stripe_payment_intent_id: intent.id,
          payment_requested_at: new Date().toISOString(),
        })
        .in("id", orderIds);

      return apiSuccess({
        clientSecret: intent.client_secret,
        stripeAccountId: org.stripe_account_id,
        orderIds,
        tipAmount,
        chargeTotal,
      });
    } catch (stripeError) {
      await revertPaymentLock();
      const circuit = handleStripeCircuitError(stripeError);
      if (circuit) return circuit;
      throw stripeError;
    }
  }
);
