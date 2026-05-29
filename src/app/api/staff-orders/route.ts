import { after } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { getCurrentStaff } from "@/lib/auth/session";
import { logger } from "@/lib/logger";
import {
  createStaffOrder,
  createStaffOrderSchema,
} from "@/lib/orders/create-staff-order";
import { emitStaffOrderSideEffects } from "@/lib/orders/emit-staff-order-side-effects";
import { withStaffRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export const POST = withErrorHandler("staff-orders-post", async (req, _ctx) => {
  const limited = await withStaffRateLimit(req);
  if (limited) return limited;

  const staff = await getCurrentStaff();
  if (!staff) {
    return apiError("Unauthorized.", 401);
  }

  const body = await req.json();
  const parsed = createStaffOrderSchema.safeParse(body);

  if (!parsed.success) {
    return apiError("Invalid input.", 400, parsed.error.flatten());
  }

  const result = await createStaffOrder(staff, parsed.data);

  if ("error" in result && result.error) {
    const details =
      "products" in result && Array.isArray(result.products)
        ? { products: result.products }
        : undefined;
    return apiError(result.error, result.status ?? 500, details);
  }

  if (
    "sideEffects" in result &&
    result.sideEffects &&
    "sessionId" in result &&
    result.sessionId
  ) {
    const { sideEffects, sessionId } = result;
    const admin = createAdminClient();
    after(async () => {
      try {
        await emitStaffOrderSideEffects(admin, { sideEffects, sessionId });
      } catch (err) {
        logger.error("emitStaffOrderSideEffects failed (staff order)", {
          orderId: sideEffects.orderId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });
  }

  return apiSuccess(result.data);
});
