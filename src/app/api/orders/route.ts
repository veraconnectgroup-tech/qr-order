import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { createOrderFromCart, createOrderSchema } from "@/lib/orders/create-order";
import { withRateLimit } from "@/lib/rate-limit";

export const POST = withErrorHandler("orders-post", async (req, _ctx) => {
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
        : "blockedUntil" in result && result.blockedUntil
          ? { blockedUntil: result.blockedUntil }
          : undefined;
    return apiError(result.error, result.status ?? 500, details);
  }

  return apiSuccess(result.data);
});
