export const maxDuration = 15;


import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { verifyOrderSessionAccess } from "@/lib/orders/validate-table-session";
import { withGuestRateLimits } from "@/lib/rate-limit";
import { resolveOrgIdFromOrderId } from "@/lib/rate-limit/org-context";
import { isUuid } from "@/lib/security/sanitize";
import { zSessionToken } from "@/lib/security/zod-fields";
import {
  getAvailablePaymentMethods,
  type SelectablePaymentMethod,
} from "@/lib/payment-methods";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseCheckoutOrderRow } from "@/lib/supabase/parse-order-rows";
import { getStripe } from "@/lib/stripe/client";
import { calcPlatformFee } from "@/lib/stripe/connect";
import { buildPaymentIdempotencyKey } from "@/lib/resilience/idempotency";
import {
  handleStripeCircuitError,
  withStripeCircuit,
} from "@/lib/stripe/with-stripe-circuit";
import { schedulePaymentRequestPush } from "@/lib/push/schedule-notify";

const schema = z.object({
  sessionToken: zSessionToken(),
  paymentMethod: z.enum(["online", "at_bar", "card_at_table"]),
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
    stripeOnboarded: Boolean((org as { stripe_onboarded: boolean } | null)?.stripe_onboarded),
    stripePublishableKey: Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY),
    paymentOnlineEnabled: loc.payment_online_enabled,
    paymentAtBarEnabled: loc.payment_at_bar_enabled,
    paymentCardAtTableEnabled: loc.payment_card_at_table_enabled,
  });
}

export const POST = withErrorHandler(
  "orders-orderId-checkout-post",
  async (req, ctx) => {
    const { orderId } = await ctx.params;
    const orgId = await resolveOrgIdFromOrderId(orderId);
    const limited = await withGuestRateLimits(req, "payments", orgId);
    if (limited) return limited;

    if (!isUuid(orderId)) {
      return apiError("Invalid order id.", 400);
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return apiError("Invalid input.", 400);
    }

    const admin = createAdminClient();
    const { sessionToken, paymentMethod } = parsed.data;

    const allowed = await verifyOrderSessionAccess(
      admin,
      orderId,
      sessionToken
    );
    if (!allowed) {
      return apiError("Unauthorized.", 401);
    }

    const { data: order } = await admin
      .from("orders")
      .select(
        "id, total, payment_status, payment_method, stripe_payment_intent_id, location_id, status, table_id, tables(name)"
      )
      .eq("id", orderId)
      .single();

    if (!order) {
      return apiError("Order not found.", 404);
    }

    const orderRow = parseCheckoutOrderRow(order);

    if (orderRow.payment_status === "paid") {
      return apiError("Already paid.", 400);
    }

    if (orderRow.status === "rejected" || orderRow.status === "cancelled") {
      return apiError("Order is closed.", 400);
    }

    const methods = await loadPaymentOptions(orderRow.location_id);
    if (!methods?.includes(paymentMethod as SelectablePaymentMethod)) {
      return apiError("This payment method is not available.", 400);
    }

    const now = new Date().toISOString();

    await admin
      .from("orders")
      .update({
        payment_method: paymentMethod,
        payment_requested_at: now,
      })
      .eq("id", orderId);

    if (paymentMethod !== "online") {
      schedulePaymentRequestPush(
        orderRow.location_id,
        orderRow.tables?.name ?? "Table",
        orderRow.table_id ?? undefined
      );
      return apiSuccess({ ok: true, paymentMethod });
    }

    const { data: locked, error: lockErr } = await admin
      .from("orders")
      .update({ payment_status: "processing" })
      .eq("id", orderId)
      .eq("payment_status", "pending")
      .select("id");

    if (lockErr) {
      return apiError(lockErr.message, 500);
    }

    if (!locked || locked.length === 0) {
      return apiError("Payment already in progress.", 409);
    }

    async function revertPaymentLock() {
      await admin
        .from("orders")
        .update({ payment_status: "pending" })
        .eq("id", orderId)
        .eq("payment_status", "processing");
    }

    try {
      if (orderRow.stripe_payment_intent_id) {
        const stripe = getStripe();
        const existing = await withStripeCircuit(() =>
          stripe.paymentIntents.retrieve(orderRow.stripe_payment_intent_id!)
        );
        if (existing.client_secret) {
          const { data: location } = await admin
            .from("locations")
            .select("org_id")
            .eq("id", orderRow.location_id)
            .single();
          const { data: orgData } = await admin
            .from("organizations")
            .select("stripe_account_id")
            .eq("id", (location as { org_id: string }).org_id)
            .single();

          return apiSuccess({
            clientSecret: existing.client_secret,
            stripeAccountId: (orgData as { stripe_account_id: string })
              .stripe_account_id,
          });
        }
      }

      const { data: location } = await admin
        .from("locations")
        .select("org_id")
        .eq("id", orderRow.location_id)
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
        await revertPaymentLock();
        return apiError("Online payments are not available.", 400);
      }

      const stripe = getStripe();
      const amountCents = Math.round(Number(orderRow.total) * 100);
      const applicationFee = calcPlatformFee(Number(orderRow.total), {
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
            metadata: { order_id: orderId },
          },
          {
            stripeAccount: org.stripe_account_id!,
            idempotencyKey: buildPaymentIdempotencyKey(
              (location as { org_id: string }).org_id,
              orderId,
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
          stripe_payment_intent_id: intent.id,
          payment_status: "processing",
        })
        .eq("id", orderId);

      return apiSuccess({
        clientSecret: intent.client_secret,
        stripeAccountId: org.stripe_account_id,
      });
    } catch (stripeError) {
      await revertPaymentLock();
      const circuit = handleStripeCircuitError(stripeError);
      if (circuit) return circuit;
      throw stripeError;
    }
  }
);
