import { NextRequest } from "next/server";
import { authenticateApiKey, requireScope } from "@/lib/api/v1/auth";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { apiError, apiSuccess } from "@/lib/api-response";
import { noCache } from "@/lib/cache/headers";
import { withRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export const GET = withErrorHandler("v1-products-get", async (req: NextRequest) => {
  const headers = noCache();
  const limited = await withRateLimit(req, "default");
  if (limited) return limited;

  const auth = await authenticateApiKey(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "menu:read");
  if (scopeErr) return scopeErr;

  if (!auth.locationIds.length) {
    return apiSuccess({ categories: [] }, 200, headers);
  }

  const admin = createAdminClient();
  const locationId = auth.locationIds[0];

  const { data, error } = await admin
    .from("categories")
    .select("*, products(*)")
    .eq("location_id", locationId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("sort_order");

  if (error) return apiError(error.message, 500, undefined, headers);
  return apiSuccess({ categories: data ?? [] }, 200, headers);
});
