import { NextRequest } from "next/server";
import { authenticateApiKey, requireScope } from "@/lib/api/v1/auth";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { apiError, apiSuccess } from "@/lib/api-response";
import { noCache } from "@/lib/cache/headers";
import { withRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export const GET = withErrorHandler("v1-sessions-get", async (req: NextRequest) => {
  const headers = noCache();
  const limited = await withRateLimit(req, "default");
  if (limited) return limited;

  const auth = await authenticateApiKey(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "sessions:read");
  if (scopeErr) return scopeErr;

  if (!auth.locationIds.length) {
    return apiSuccess({ sessions: [] }, 200, headers);
  }

  const status = req.nextUrl.searchParams.get("status") ?? "active";
  const admin = createAdminClient();

  let query = admin
    .from("table_sessions")
    .select("id, table_id, location_id, status, opened_at, closed_at, guest_email")
    .in("location_id", auth.locationIds)
    .order("opened_at", { ascending: false })
    .limit(100);

  if (status !== "all") {
    query = query.eq("status", status as "active" | "closed");
  }

  const { data, error } = await query;
  if (error) return apiError(error.message, 500, undefined, headers);
  return apiSuccess({ sessions: data ?? [] }, 200, headers);
});
