import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { createOrderFromCart, createOrderSchema } from "@/lib/orders/create-order";
import { withRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const limited = await withRateLimit(req, "orders");
    if (limited) return limited;

    const body = await req.json();
    const parsed = createOrderSchema.safeParse(body);

    if (!parsed.success) {
      return apiError("Invalid input", 400, parsed.error.flatten());
    }

    const result = await createOrderFromCart(parsed.data);

    if ("error" in result && result.error) {
      const details =
        "products" in result && Array.isArray(result.products)
          ? { products: result.products }
          : undefined;
      return apiError(result.error, result.status ?? 500, details);
    }

    return apiSuccess(result.data);
  } catch (error) {
    logger.error("Create order error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError("Order could not be created. Please try again.", 500);
  }
}
