import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getCurrentStaff } from "@/lib/auth/session";
import { logger } from "@/lib/logger";
import {
  createStaffOrder,
  createStaffOrderSchema,
} from "@/lib/orders/create-staff-order";
import { withRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
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
  } catch (error) {
    logger.error("Create staff order error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError("Order could not be created. Please try again.", 500);
  }
}
