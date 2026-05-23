import { z } from "zod";
import { NextRequest } from "next/server";
import { authenticateApiKey, requireScope } from "@/lib/api/v1/auth";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { apiError, apiSuccess } from "@/lib/api-response";
import { noCache } from "@/lib/cache/headers";
import { dispatchOrgWebhook } from "@/lib/webhooks/dispatch";
import { withRateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/security/sanitize";
import { createAdminClient } from "@/lib/supabase/admin";

const patchSchema = z.object({
  status: z.enum(["accepted", "preparing", "ready", "delivered", "rejected"]),
});

async function loadOrder(orderId: string, locationIds: string[]) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("orders")
    .select("*, order_items(*, order_item_modifiers(*)), tables(name)")
    .eq("id", orderId)
    .maybeSingle();

  if (!data) return null;
  const order = data as { location_id: string };
  if (!locationIds.includes(order.location_id)) return null;
  return data;
}

export const GET = withErrorHandler(
  "v1-orders-id-get",
  async (req: NextRequest, ctx) => {
    const headers = noCache();
    const limited = await withRateLimit(req, "default");
    if (limited) return limited;

    const auth = await authenticateApiKey(req);
    if (auth instanceof Response) return auth;
    const scopeErr = requireScope(auth, "orders:read");
    if (scopeErr) return scopeErr;

    const { orderId } = await ctx.params;
    if (!isUuid(orderId)) return apiError("Invalid order id.", 400, undefined, headers);

    const order = await loadOrder(orderId, auth.locationIds);
    if (!order) return apiError("Not found.", 404, undefined, headers);

    return apiSuccess(order, 200, headers);
  }
);

export const PATCH = withErrorHandler(
  "v1-orders-id-patch",
  async (req: NextRequest, ctx) => {
    const headers = noCache();
    const limited = await withRateLimit(req, "default");
    if (limited) return limited;

    const auth = await authenticateApiKey(req);
    if (auth instanceof Response) return auth;
    const scopeErr = requireScope(auth, "orders:write");
    if (scopeErr) return scopeErr;

    const { orderId } = await ctx.params;
    if (!isUuid(orderId)) return apiError("Invalid order id.", 400, undefined, headers);

    const body = await req.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return apiError("Invalid input.", 400, undefined, headers);

    const admin = createAdminClient();
    const existing = await loadOrder(orderId, auth.locationIds);
    if (!existing) return apiError("Not found.", 404, undefined, headers);

    const prev = existing as { status: string; location_id: string };
    const now = new Date().toISOString();
    const status = parsed.data.status;
    const updates: Record<string, string | null> = { status };

    if (status === "accepted") updates.accepted_at = now;
    if (status === "preparing") updates.preparing_at = now;
    if (status === "ready") updates.ready_at = now;
    if (status === "delivered") updates.delivered_at = now;

    const { error } = await admin
      .from("orders")
      .update(updates as never)
      .eq("id", orderId);

    if (error) return apiError(error.message, 500, undefined, headers);

    dispatchOrgWebhook(auth.orgId, "order.status_changed", {
      order_id: orderId,
      previous_status: prev.status,
      status,
    });

    if (status === "rejected") {
      dispatchOrgWebhook(auth.orgId, "order.cancelled", { order_id: orderId, status });
    }

    return apiSuccess({ ok: true, status }, 200, headers);
  }
);
