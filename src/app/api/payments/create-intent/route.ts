import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { verifyOrderSessionAccess } from "@/lib/orders/validate-table-session";
import { withGuestRateLimits } from "@/lib/rate-limit";
import { resolveOrgIdFromOrderId, resolveOrgIdFromTableToken } from "@/lib/rate-limit/org-context";
import { zSessionToken, zUuid } from "@/lib/security/zod-fields";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";
import { calcPlatformFee } from "@/lib/stripe/connect";
import { buildPaymentIdempotencyKey } from "@/lib/resilience/idempotency";
import {
  handleStripeCircuitError,
  withStripeCircuit,
} from "@/lib/stripe/with-stripe-circuit";

const schema = z.object({
  orderId: zUuid(),
  sessionToken: zSessionToken(),
});

export const POST = withErrorHandler(
  "payments-create-intent-post",
  async (req, _ctx) => {
    let orgId: string | null = null;
    try {
      const peek = (await req.clone().json()) as { orderId?: string };
      if (typeof peek.orderId === "string") {
        orgId = await resolveOrgIdFromOrderId(peek.orderId);
      }
    } catch {
      orgId = null;
    }

    const limited = await withGuestRateLimits(req, "payments", orgId);
    if (limited) return limited;

    const body = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return apiError("Invalid input", 400, parsed.error.flatten());
    }

    const admin = createAdminClient();
    const { orderId, sessionToken } = parsed.data;

    const hasAccess = await verifyOrderSessionAccess(
      admin,
      orderId,
      sessionToken
    );

    if (!hasAccess) {
      return apiError("Unauthorized", 401);
    }

    const { data: order } = await admin
      .from("orders")
      .select(
        "id, total, payment_status, payment_method, stripe_payment_intent_id, location_id, status"
      )
      .eq("id", orderId)
      .single();

    if (!order) {
      return apiError("Order not found.", 404);
    }

    const orderRow = order as {
      id: string;
      total: number;
      payment_status: string;
      payment_method: string;
      stripe_payment_intent_id: string | null;
      location_id: string;
      status: string;
    };

    if (orderRow.payment_method !== "online") {
      return apiError("This order uses an in-venue payment method.", 400);
    }

    if (orderRow.status === "rejected" || orderRow.status === "cancelled") {
      return apiError("Order is no longer payable.", 400);
    }

    const { data: location } = await admin
      .from("locations")
      .select("org_id")
      .eq("id", orderRow.location_id)
      .single();

    if (!location) {
      return apiError("Location not found.", 404);
    }

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
    } | null;

    if (!org?.stripe_onboarded || !org.stripe_account_id) {
      return apiError("Payments are not configured for this venue.", 400);
    }

    if (orderRow.payment_status === "paid") {
      return apiError("Already paid.", 400);
    }

    const stripe = getStripe();

    try {
      if (orderRow.stripe_payment_intent_id) {
        const existing = await withStripeCircuit(() =>
          stripe.paymentIntents.retrieve(orderRow.stripe_payment_intent_id!)
        );
        const amountCents = Math.round(Number(orderRow.total) * 100);
        const platformFee = calcPlatformFee(Number(orderRow.total), {
          feePercent: org.platform_fee_percent,
          feeFixed: org.platform_fee_fixed,
        });

        if (existing.amount !== amountCents) {
          await withStripeCircuit(() =>
            stripe.paymentIntents.update(orderRow.stripe_payment_intent_id!, {
              amount: amountCents,
              application_fee_amount: platformFee,
            })
          );
        }

        if (existing.client_secret) {
          return apiSuccess({
            clientSecret: existing.client_secret,
            stripeAccountId: org.stripe_account_id,
          });
        }
      }

      const platformFee = calcPlatformFee(Number(orderRow.total), {
        feePercent: org.platform_fee_percent,
        feeFixed: org.platform_fee_fixed,
      });

      const amountCents = Math.round(Number(orderRow.total) * 100);
      const orgId = (location as { org_id: string }).org_id;

      const paymentIntent = await withStripeCircuit(() =>
        stripe.paymentIntents.create(
          {
            amount: amountCents,
            currency: org.currency.toLowerCase(),
            application_fee_amount: platformFee,
            transfer_data: { destination: org.stripe_account_id! },
            metadata: {
              order_id: orderRow.id,
              location_id: orderRow.location_id,
            },
            automatic_payment_methods: { enabled: true },
          },
          {
            idempotencyKey: buildPaymentIdempotencyKey(
              orgId,
              orderRow.id,
              amountCents
            ),
          }
        )
      );

      await admin
        .from("orders")
        .update({
          stripe_payment_intent_id: paymentIntent.id,
          payment_status: "processing",
        })
        .eq("id", orderRow.id);

      return apiSuccess({
        clientSecret: paymentIntent.client_secret,
        stripeAccountId: org.stripe_account_id,
      });
    } catch (error) {
      const circuit = handleStripeCircuitError(error);
      if (circuit) return circuit;
      throw error;
    }
  }
);
