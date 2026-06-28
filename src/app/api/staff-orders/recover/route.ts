import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { getCurrentStaff } from "@/lib/auth/session";
import { resolveStaffOrderByClientOrderId } from "@/lib/orders/create-staff-order";
import { createAdminClient } from "@/lib/supabase/admin";
import { zUuid } from "@/lib/security/zod-fields";
import { withStaffRateLimit } from "@/lib/rate-limit";

/** Recover a POS sync row when the order was created but the client never got 200. */
export const GET = withErrorHandler("staff-orders-recover", async (req, _ctx) => {
  const limited = await withStaffRateLimit(req);
  if (limited) return limited;

  const staff = await getCurrentStaff();
  if (!staff) {
    return apiError("Unauthorized.", 401);
  }

  const clientOrderId = req.nextUrl.searchParams.get("clientOrderId");
  if (!zUuid().safeParse(clientOrderId).success) {
    return apiError("Invalid input.", 400);
  }

  const admin = createAdminClient();
  const existing = await resolveStaffOrderByClientOrderId(
    admin,
    clientOrderId!
  );

  if (!existing) {
    return apiError("Order not found for clientOrderId.", 404);
  }

  return apiSuccess({
    ...existing,
    idempotent: true as const,
  });
});
