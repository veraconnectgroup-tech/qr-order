export const maxDuration = 15;

import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { getCurrentStaff } from "@/lib/auth/session";
import { processRefund } from "@/lib/stripe/refund";
import { withRateLimit } from "@/lib/rate-limit";
import { sanitizeOrderNotes } from "@/lib/security/sanitize";
import { isUuid } from "@/lib/security/sanitize";
import { createAdminClient } from "@/lib/supabase/admin";

const refundSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, "Reason is required")
    .max(500)
    .transform((value) => sanitizeOrderNotes(value)),
  amount: z.number().positive().optional(),
});

async function requireRefundStaff() {
  const staff = await getCurrentStaff();
  if (!staff || !["owner", "manager"].includes(staff.role)) {
    return null;
  }
  return staff;
}

export const POST = withErrorHandler(
  "orders-orderId-refund-post",
  async (req, ctx) => {
    const limited = await withRateLimit(req, "payments");
    if (limited) return limited;

    const staff = await requireRefundStaff();
    if (!staff) {
      return apiError("Unauthorized.", 401);
    }

    const { orderId } = await ctx.params;
    if (!isUuid(orderId)) {
      return apiError("Invalid order id.", 400);
    }

    const body = await req.json();
    const parsed = refundSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid input.", 400, parsed.error.flatten());
    }

    const admin = createAdminClient();
    const { data: order } = await admin
      .from("orders")
      .select(
        "id, location_id, payment_status, payment_method, stripe_payment_intent_id, total, created_at, tse_signature"
      )
      .eq("id", orderId)
      .single();

    if (!order) {
      return apiError("Order not found.", 404);
    }

    const orderRow = order as {
      id: string;
      location_id: string;
      payment_status: string;
      payment_method: string;
      stripe_payment_intent_id: string | null;
      total: number;
      created_at: string;
      tse_signature: string | null;
    };

    if (staff.location_id && staff.location_id !== orderRow.location_id) {
      return apiError("Forbidden.", 403);
    }

    const { data: location } = await admin
      .from("locations")
      .select("org_id")
      .eq("id", orderRow.location_id)
      .single();

    if (!location || (location as { org_id: string }).org_id !== staff.org_id) {
      return apiError("Forbidden.", 403);
    }

    const result = await processRefund(
      orderRow,
      staff.id,
      parsed.data.reason,
      { amount: parsed.data.amount }
    );

    if ("error" in result) {
      return apiError(result.error, 400);
    }

    return apiSuccess({
      ok: true,
      refundId: result.refundId,
      amount: result.amount,
      paymentStatus:
        result.amount >= Number(orderRow.total) - 0.01
          ? "refunded"
          : "partial_refund",
    });
  }
);
