import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { getCurrentStaff } from "@/lib/auth/session";
import { resendOrderReceipt } from "@/lib/email/send-order-receipt";
import { withRateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/security/sanitize";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireManagerStaff() {
  const staff = await getCurrentStaff();
  if (!staff || !["owner", "manager"].includes(staff.role)) {
    return null;
  }
  return staff;
}

export const POST = withErrorHandler(
  "orders-resend-receipt-post",
  async (_req, ctx) => {
    const limited = await withRateLimit(_req, "default");
    if (limited) return limited;

    const staff = await requireManagerStaff();
    if (!staff) {
      return apiError("Unauthorized.", 401);
    }

    const { orderId } = await ctx.params;
    if (!isUuid(orderId)) {
      return apiError("Invalid order id.", 400);
    }

    const admin = createAdminClient();
    const { data: order } = await admin
      .from("orders")
      .select("id, location_id, session_id")
      .eq("id", orderId)
      .single();

    if (!order) {
      return apiError("Order not found.", 404);
    }

    const row = order as {
      id: string;
      location_id: string;
      session_id: string | null;
    };

    if (staff.location_id && staff.location_id !== row.location_id) {
      return apiError("Forbidden.", 403);
    }

    const { data: location } = await admin
      .from("locations")
      .select("org_id")
      .eq("id", row.location_id)
      .single();

    if (!location || (location as { org_id: string }).org_id !== staff.org_id) {
      return apiError("Forbidden.", 403);
    }

    if (!row.session_id) {
      return apiError("No guest session for this order.", 400);
    }

    const { data: session } = await admin
      .from("table_sessions")
      .select("guest_email")
      .eq("id", row.session_id)
      .single();

    if (!(session as { guest_email: string | null } | null)?.guest_email) {
      return apiError("No guest email on file.", 400);
    }

    const result = await resendOrderReceipt(orderId);
    if (!result.sent) {
      return apiError(result.error ?? "Receipt could not be sent.", 400);
    }

    return apiSuccess({ ok: true });
  }
);
