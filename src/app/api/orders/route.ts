import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { createOrderFromCart, createOrderSchema } from "@/lib/orders/create-order";
import {
  findOrderByIdempotencyKey,
  parseIdempotencyKey,
} from "@/lib/orders/idempotency";
import {
  cacheOrderIdempotency,
  getCachedOrderIdempotency,
} from "@/lib/resilience/idempotency";
import { withGuestRateLimits } from "@/lib/rate-limit";
import { resolveOrgIdFromTableToken } from "@/lib/rate-limit/org-context";
import { createAdminClient } from "@/lib/supabase/admin";

async function resolveOrgIdFromOrdersRequest(req: Request): Promise<string | null> {
  try {
    const body = (await req.clone().json()) as { tableToken?: string };
    if (typeof body.tableToken === "string") {
      return resolveOrgIdFromTableToken(body.tableToken);
    }
  } catch {
    return null;
  }
  return null;
}

export const POST = withErrorHandler("orders-post", async (req, _ctx) => {
  const orgId = await resolveOrgIdFromOrdersRequest(req);
  const limited = await withGuestRateLimits(req, "orders-guest", orgId);
  if (limited) return limited;

  const idempotencyKey = parseIdempotencyKey(
    req.headers.get("X-Idempotency-Key") ?? req.headers.get("Idempotency-Key")
  );

  if (idempotencyKey) {
    const cached = await getCachedOrderIdempotency(idempotencyKey);
    if (cached) {
      return apiSuccess(cached, 200, { "Idempotent-Replay": "true" });
    }

    const admin = createAdminClient();
    const existing = await findOrderByIdempotencyKey(admin, idempotencyKey);
    if (existing) {
      await cacheOrderIdempotency(idempotencyKey, existing);
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

  if (idempotencyKey && result.data) {
    await cacheOrderIdempotency(idempotencyKey, result.data);
  }

  return apiSuccess(result.data, 201, headers);
});
