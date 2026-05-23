import { NextRequest } from "next/server";
import { authenticateApiKey, requireScope } from "@/lib/api/v1/auth";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { apiError, apiSuccess } from "@/lib/api-response";
import { noCache } from "@/lib/cache/headers";
import { withRateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/security/sanitize";
import { createAdminClient } from "@/lib/supabase/admin";

async function authOrError(req: NextRequest, scope: import("@/lib/api/v1/scopes").ApiScope) {
  const limited = await withRateLimit(req, "default");
  if (limited) return { error: limited };

  const auth = await authenticateApiKey(req);
  if (auth instanceof Response) return { error: auth };

  const scopeErr = requireScope(auth, scope);
  if (scopeErr) return { error: scopeErr };

  return { ctx: auth };
}

export const GET = withErrorHandler("v1-orders-get", async (req) => {
  const headers = noCache();
  const result = await authOrError(req, "orders:read");
  if ("error" in result && result.error) return result.error;
  const { ctx } = result;

  if (!ctx!.locationIds.length) {
    return apiSuccess({ orders: [], total: 0 }, 200, headers);
  }

  const limit = Math.min(
    Number(req.nextUrl.searchParams.get("limit") ?? 50),
    100
  );
  const status = req.nextUrl.searchParams.get("status");

  const admin = createAdminClient();
  let query = admin
    .from("orders")
    .select(
      "id, order_number, status, payment_status, payment_method, subtotal, tax_amount, total, created_at, location_id, session_id",
      { count: "exact" }
    )
    .in("location_id", ctx!.locationIds)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) {
    query = query.eq(
      "status",
      status as "pending" | "accepted" | "preparing" | "ready" | "delivered" | "rejected" | "cancelled"
    );
  }

  const { data, count, error } = await query;
  if (error) return apiError(error.message, 500, undefined, headers);

  return apiSuccess({ orders: data ?? [], total: count ?? 0 }, 200, headers);
});
