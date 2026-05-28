import { submitFeedbackIdempotencyKey } from "@/lib/commerce/capabilities/feedback-v2/submit-feedback";
import {
  isPaidForExperience,
  ratingToSentiment,
  resolveExperienceMoment,
  type FeedbackCategory,
  type FeedbackSentiment,
} from "@/lib/commerce/experience/resolve-experience-moment";
import { runCommerceExperience } from "@/lib/commerce/runtime/run-commerce-experience";
import { isPaidPaymentStatus } from "@/lib/orders/payment-status";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SubmitSessionFeedbackInput = {
  orderId: string;
  sessionId: string;
  rating: number;
  comment?: string | null;
  sentiment?: FeedbackSentiment;
  category?: FeedbackCategory | null;
  traceId?: string;
};

export type SubmitSessionFeedbackResult =
  | { ok: true; eventId: string }
  | {
      ok: false;
      code:
        | "order_not_found"
        | "session_mismatch"
        | "not_eligible"
        | "already_submitted"
        | "finalize_failed";
    };

export async function submitSessionFeedback(
  admin: SupabaseClient,
  input: SubmitSessionFeedbackInput
): Promise<SubmitSessionFeedbackResult> {
  const { data: order } = await admin
    .from("orders")
    .select("id, session_id, location_id, status, payment_status")
    .eq("id", input.orderId)
    .maybeSingle();

  if (!order) {
    return { ok: false, code: "order_not_found" };
  }

  const orderRow = order as {
    id: string;
    session_id: string | null;
    location_id: string;
    status: string;
    payment_status: string;
  };

  if (orderRow.session_id !== input.sessionId) {
    return { ok: false, code: "session_mismatch" };
  }

  const [{ data: sessionState }, { data: sessionOrders }] = await Promise.all([
    admin
      .from("guest_session_commerce_state" as never)
      .select("bill_settled, feedback_submitted")
      .eq("session_id", input.sessionId)
      .maybeSingle(),
    admin
      .from("orders")
      .select("status")
      .eq("session_id", input.sessionId),
  ]);

  const state = sessionState as
    | { bill_settled: boolean; feedback_submitted: boolean }
    | null;

  if (state?.feedback_submitted) {
    return { ok: false, code: "already_submitted" };
  }

  const orderStatuses = (sessionOrders ?? []) as { status: string }[];
  const allSessionOrdersDelivered =
    orderStatuses.length > 0 &&
    orderStatuses.every((row) => row.status === "delivered");

  const moment = resolveExperienceMoment({
    paymentStatus: orderRow.payment_status,
    orderStatus: orderRow.status,
    sessionBillSettled: state?.bill_settled ?? false,
    allSessionOrdersDelivered,
  });

  if (moment !== "feedback_eligible") {
    return { ok: false, code: "not_eligible" };
  }

  const sentiment = input.sentiment ?? ratingToSentiment(input.rating);

  const result = await runCommerceExperience(
    admin,
    {
      kind: "guest_command",
      sessionId: input.sessionId,
      idempotencyKey: submitFeedbackIdempotencyKey(input.sessionId),
      command: {
        type: "SubmitFeedback",
        payload: {
          orderId: input.orderId,
          rating: input.rating,
          sentiment,
          category: input.category ?? null,
          comment: input.comment ?? null,
          triggerMoment:
            state?.bill_settled === true ? "session_bill" : "order_delivered",
        },
      },
    },
    {
      traceId: input.traceId,
      idempotencyKey: submitFeedbackIdempotencyKey(input.sessionId),
    }
  );

  if (result.skipped) {
    if (
      result.reason === "feedback_already_submitted" ||
      result.reason === "already_submitted"
    ) {
      return { ok: false, code: "already_submitted" };
    }
    return {
      ok: false,
      code:
        result.reason === "finalize_failed"
          ? "finalize_failed"
          : "already_submitted",
    };
  }

  if (!result.eventId) {
    return { ok: false, code: "finalize_failed" };
  }

  return { ok: true, eventId: result.eventId };
}

export function orderEligibleForLegacyFeedback(order: {
  status: string;
  payment_status: string;
}): boolean {
  return (
    order.status === "delivered" &&
    (isPaidPaymentStatus(order.payment_status) ||
      isPaidForExperience(order.payment_status))
  );
}
