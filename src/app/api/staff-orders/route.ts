import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { getCurrentStaff } from "@/lib/auth/session";
import {
  createStaffOrder,
  createStaffOrderSchema,
} from "@/lib/orders/create-staff-order";
import { withRateLimit } from "@/lib/rate-limit";

export const POST = withErrorHandler("staff-orders-post", async (req, _ctx) => {
  const limited = await withRateLimit(req, "orders");
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

  return apiSuccess(result.data);
});
