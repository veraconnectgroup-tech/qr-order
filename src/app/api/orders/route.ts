import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { createOrderFromCart, createOrderSchema } from "@/lib/orders/create-order";
import {
  findOrderByIdempotencyKey,
  parseIdempotencyKey,
} from "@/lib/orders/idempotency";
import { withRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export const POST = withErrorHandler("orders-post", async (req, _ctx) => {
  const limited = await withRateLimit(req, "orders-guest");
  if (limited) return limited;

  const idempotencyKey = parseIdempotencyKey(
    req.headers.get("Idempotency-Key")
  );

  if (idempotencyKey) {
    const admin = createAdminClient();
    const existing = await findOrderByIdempotencyKey(admin, idempotencyKey);
    if (existing) {
      return apiSuccess(existing, 200, { "Idempotent-Replay": "true" });
    }
  }

  const body = await req.json();
  const parsed = createOrderSchema.safeParse(body);

  if (!parsed.success) {
    return apiError("Invalid input", 400, parsed.error.flatten());
  }

  const result = await createOrderFromCart(parsed.data, { idempotencyKey });

  if ("error" in result && result.error) {
    const details =
      "products" in result && Array.isArray(result.products)
        ? { products: result.products }
        : "blockedUntil" in result && result.blockedUntil
          ? { blockedUntil: result.blockedUntil }
          : undefined;
    return apiError(result.error, result.status ?? 500, details);
  }

  const headers = idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined;
  return apiSuccess(result.data, 201, headers);
});
