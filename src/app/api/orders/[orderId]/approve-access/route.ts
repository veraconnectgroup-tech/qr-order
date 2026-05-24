import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import {
  approveOrderAccess,
  rejectOrderAccess,
} from "@/lib/sessions/approve-order-access";
import { withRateLimit } from "@/lib/rate-limit";
import { zOrderNotesOptional } from "@/lib/security/zod-fields";
import { isUuid } from "@/lib/security/sanitize";
import { createServerClient } from "@/lib/supabase/server";
import type { Staff } from "@/types";

async function loadStaff(): Promise<Staff | null> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: staff } = await supabase
    .from("staff")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();

  return (staff as Staff | null) ?? null;
}

const rejectSchema = z.object({
  rejectionReason: zOrderNotesOptional(),
});

export const POST = withErrorHandler(
  "orders-orderId-approve-access-post",
  async (req, ctx) => {
    const limited = await withRateLimit(req, "orders");
    if (limited) return limited;

    const staff = await loadStaff();
    if (!staff) {
      return apiError("Unauthorized.", 401);
    }

    const { orderId } = await ctx.params;
    if (!isUuid(orderId)) {
      return apiError("Invalid order id.", 400);
    }

    const result = await approveOrderAccess(staff, orderId);
    if ("error" in result) {
      return apiError(result.error, result.status);
    }

    return apiSuccess(result.data);
  }
);

export const DELETE = withErrorHandler(
  "orders-orderId-approve-access-delete",
  async (req, ctx) => {
    const limited = await withRateLimit(req, "orders");
    if (limited) return limited;

    const staff = await loadStaff();
    if (!staff) {
      return apiError("Unauthorized.", 401);
    }

    const { orderId } = await ctx.params;
    if (!isUuid(orderId)) {
      return apiError("Invalid order id.", 400);
    }

    const body = await req.json().catch(() => ({}));
    const parsed = rejectSchema.safeParse(body);

    const result = await rejectOrderAccess(
      staff,
      orderId,
      parsed.success ? parsed.data.rejectionReason : undefined
    );

    if ("error" in result) {
      return apiError(result.error, result.status);
    }

    return apiSuccess(result.data);
  }
);
