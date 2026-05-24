export const maxDuration = 30;

import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { safeJsonParse } from "@/lib/api/safe-json";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { getCurrentStaff } from "@/lib/auth/session";
import { performStorno } from "@/lib/fiscal/storno";
import { withStaffRateLimit } from "@/lib/rate-limit";
import { isUuid, sanitizeOrderNotes } from "@/lib/security/sanitize";
import { createAdminClient } from "@/lib/supabase/admin";

const stornoSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Reason must be at least 3 characters")
    .max(500)
    .transform((value) => sanitizeOrderNotes(value)),
  amount: z.number().positive().optional(),
});

async function requireStornoStaff() {
  const staff = await getCurrentStaff();
  if (!staff || !["owner", "manager"].includes(staff.role)) {
    return null;
  }
  return staff;
}

export const POST = withErrorHandler(
  "orders-orderId-storno-post",
  async (req, ctx) => {
    const limited = await withStaffRateLimit(req);
    if (limited) return limited;

    const staff = await requireStornoStaff();
    if (!staff) {
      return apiError("Unauthorized.", 401);
    }

    const { orderId } = await ctx.params;
    if (!isUuid(orderId)) {
      return apiError("Invalid order id.", 400);
    }

    const body = await safeJsonParse(req);
    if (!body) {
      return apiError("Invalid JSON.", 400);
    }

    const parsed = stornoSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid input.", 400, parsed.error.flatten());
    }

    const admin = createAdminClient();
    const { data: order } = await admin
      .from("orders")
      .select("id, location_id")
      .eq("id", orderId)
      .maybeSingle();

    if (!order) {
      return apiError("Order not found.", 404);
    }

    const orderRow = order as { id: string; location_id: string };

    if (staff.location_id && staff.location_id !== orderRow.location_id) {
      return apiError("Unauthorized.", 403);
    }

    const { data: location } = await admin
      .from("locations")
      .select("org_id")
      .eq("id", orderRow.location_id)
      .maybeSingle();

    if (!location || (location as { org_id: string }).org_id !== staff.org_id) {
      return apiError("Unauthorized.", 403);
    }

    const result = await performStorno({
      orderId,
      reason: parsed.data.reason,
      performedBy: staff.id,
      amount: parsed.data.amount,
    });

    if ("error" in result) {
      return apiError(result.error, result.code);
    }

    return apiSuccess({
      stornoId: result.stornoId,
      tseSignature: result.tseSignature,
    });
  }
);
