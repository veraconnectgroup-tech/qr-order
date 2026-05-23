import { NextRequest } from "next/server";
import { authenticateApiKey, requireScope } from "@/lib/api/v1/auth";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { apiError, apiSuccess } from "@/lib/api-response";
import { noCache } from "@/lib/cache/headers";
import { withRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export const GET = withErrorHandler("v1-tables-get", async (req: NextRequest) => {
  const headers = noCache();
  const limited = await withRateLimit(req, "default");
  if (limited) return limited;

  const auth = await authenticateApiKey(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "tables:read");
  if (scopeErr) return scopeErr;

  if (!auth.locationIds.length) {
    return apiSuccess({ tables: [] }, 200, headers);
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tables")
    .select("id, name, seats, qr_token, zone_id, is_active")
    .in("location_id", auth.locationIds)
    .is("deleted_at", null)
    .order("name");

  if (error) return apiError(error.message, 500, undefined, headers);
  return apiSuccess({ tables: data ?? [] }, 200, headers);
});
