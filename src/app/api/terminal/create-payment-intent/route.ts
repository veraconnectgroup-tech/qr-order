import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { getCurrentStaff } from "@/lib/auth/session";
import { isPaidPaymentStatus } from "@/lib/orders/payment-status";
import { withStaffRateLimit } from "@/lib/rate-limit";
import { buildPaymentIdempotencyKey } from "@/lib/resilience/idempotency";
import { zUuid } from "@/lib/security/zod-fields";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";
import { calcPlatformFee } from "@/lib/stripe/connect";
import {
  handleStripeCircuitError,
  loadTerminalOrgContext,
  staffCanAccessLocation,
  withStripeCircuit,
} from "@/lib/stripe/terminal-context";

const schema = z
  .object({
    orderId: zUuid().optional(),
    sessionId: zUuid().optional(),
    readerId: z.string().trim().optional(),
  })
  .refine((value) => Boolean(value.orderId || value.sessionId), {
    message: "orderId or sessionId is required",
  });

export const POST = withErrorHandler(
  "terminal-create-payment-intent-post",
  async (req, _ctx) => {
    const limited = await withStaffRateLimit(req);
    if (limited) return limited;

    const staff = await getCurrentStaff();
    if (!staff) {
      return apiError("Unauthorized.", 401);
    }

    if (!["owner", "manager", "staff"].includes(staff.role)) {
      return apiError("Forbidden.", 403);
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid input.", 400, parsed.error.flatten());
    }

    const orgContext = await loadTerminalOrgContext(staff);
    if ("error" in orgContext) {
      return apiError(orgContext.error, orgContext.status);
    }

    const admin = createAdminClient();
    const stripe = getStripe();

    if (parsed.data.orderId) {
      const { data: order } = await admin
        .from("orders")
        .select(
          "id, total, tip_amount, payment_status, payment_method, stripe_payment_intent_id, location_id, status"
        )
        .eq("id", parsed.data.orderId)
        .maybeSingle();

      const orderRow = order as {
        id: string;
        total: number;
        tip_amount: number | null;
        payment_status: string;
        payment_method: string;
        stripe_payment_intent_id: string | null;
        location_id: string;
        status: string;
      } | null;

      if (!orderRow) {
        return apiError("Order not found.", 404);
      }

      if (!(await staffCanAccessLocation(staff, orderRow.location_id))) {
        return apiError("Forbidden.", 403);
      }

      if (orderRow.status === "rejected" || orderRow.status === "cancelled") {
        return apiError("Order is no longer payable.", 400);
      }

      if (isPaidPaymentStatus(orderRow.payment_status)) {
        return apiError("Order is already paid.", 409);
      }

      if (
        orderRow.payment_method !== "card_terminal" &&
        orderRow.payment_method !== "card_at_table"
      ) {
        return apiError("Order is not eligible for terminal payment.", 400);
      }

      const chargeTotal =
        Number(orderRow.total) + Number(orderRow.tip_amount ?? 0);
      const amountCents = Math.round(chargeTotal * 100);

      if (orderRow.stripe_payment_intent_id) {
        try {
          const existing = await withStripeCircuit(() =>
            stripe.paymentIntents.retrieve(
              orderRow.stripe_payment_intent_id!,
              {},
              { stripeAccount: orgContext.stripeAccountId }
            )
          );

          if (
            existing.status === "requires_payment_method" &&
            existing.amount === amountCents &&
            existing.client_secret
          ) {
            return apiSuccess({
              clientSecret: existing.client_secret,
              paymentIntentId: existing.id,
            });
          }
        } catch {
          // Create a fresh intent below.
        }
      }

      const applicationFee = calcPlatformFee(chargeTotal, {
        feePercent: orgContext.platformFeePercent,
        feeFixed: orgContext.platformFeeFixed,
      });

      try {
        const intent = await withStripeCircuit(() =>
          stripe.paymentIntents.create(
            {
              amount: amountCents,
              currency: orgContext.currency.toLowerCase(),
              payment_method_types: ["card_present"],
              capture_method: "automatic",
              application_fee_amount: applicationFee,
              metadata: {
                order_id: orderRow.id,
                terminal: "true",
              },
            },
            {
              stripeAccount: orgContext.stripeAccountId,
              idempotencyKey: buildPaymentIdempotencyKey(
                orgContext.orgId,
                orderRow.id,
                amountCents
              ),
            }
          )
        );

        if (!intent.client_secret) {
          return apiError("Payment could not be started.", 500);
        }

        await admin
          .from("orders")
          .update({
            payment_method: "card_terminal",
            payment_status: "processing",
            stripe_payment_intent_id: intent.id,
            payment_requested_at: new Date().toISOString(),
          } as never)
          .eq("id", orderRow.id);

        return apiSuccess({
          clientSecret: intent.client_secret,
          paymentIntentId: intent.id,
        });
      } catch (error) {
        const circuit = handleStripeCircuitError(error);
        if (circuit) return circuit;
        throw error;
      }
    }

    const sessionId = parsed.data.sessionId!;
    const { data: session } = await admin
      .from("table_sessions")
      .select("id, location_id, bill_status, access_state")
      .eq("id", sessionId)
      .maybeSingle();

    const sessionRow = session as {
      id: string;
      location_id: string;
      bill_status: string;
      access_state: string;
    } | null;

    if (!sessionRow) {
      return apiError("Session not found.", 404);
    }

    if (!(await staffCanAccessLocation(staff, sessionRow.location_id))) {
      return apiError("Forbidden.", 403);
    }

    const { data: sessionOrders } = await admin
      .from("orders")
      .select("id, total, tip_amount, payment_status")
      .eq("session_id", sessionId);

    const orderRows = ((sessionOrders ?? []) as Array<{
      id: string;
      total: number;
      tip_amount: number | null;
      payment_status: string;
    }>).filter((row) => !isPaidPaymentStatus(row.payment_status));

    if (orderRows.length === 0) {
      return apiError("No unpaid orders on this session.", 400);
    }

    const chargeTotal = orderRows.reduce(
      (sum, row) => sum + Number(row.total) + Number(row.tip_amount ?? 0),
      0
    );
    const amountCents = Math.round(chargeTotal * 100);
    const orderIds = orderRows.map((row) => row.id);
    const applicationFee = calcPlatformFee(chargeTotal, {
      feePercent: orgContext.platformFeePercent,
      feeFixed: orgContext.platformFeeFixed,
    });

    try {
      const intent = await withStripeCircuit(() =>
        stripe.paymentIntents.create(
          {
            amount: amountCents,
            currency: orgContext.currency.toLowerCase(),
            payment_method_types: ["card_present"],
            capture_method: "automatic",
            application_fee_amount: applicationFee,
            metadata: {
              order_id: orderIds[0],
              order_ids: orderIds.join(","),
              session_id: sessionId,
              terminal: "true",
            },
          },
          {
            stripeAccount: orgContext.stripeAccountId,
            idempotencyKey: buildPaymentIdempotencyKey(
              orgContext.orgId,
              sessionId,
              amountCents
            ),
          }
        )
      );

      if (!intent.client_secret) {
        return apiError("Payment could not be started.", 500);
      }

      await admin
        .from("orders")
        .update({
          payment_method: "card_terminal",
          payment_status: "processing",
          stripe_payment_intent_id: intent.id,
          payment_requested_at: new Date().toISOString(),
        } as never)
        .in("id", orderIds);

      return apiSuccess({
        clientSecret: intent.client_secret,
        paymentIntentId: intent.id,
        orderIds,
      });
    } catch (error) {
      const circuit = handleStripeCircuitError(error);
      if (circuit) return circuit;
      throw error;
    }
  }
);
