import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { loadTableSessionView } from "@/lib/denis/loop/load-table-session-view";
import { validateTableSession } from "@/lib/orders/validate-table-session";
import { withGuestRateLimits } from "@/lib/rate-limit";
import { resolveOrgIdFromTableToken } from "@/lib/rate-limit/org-context";
import { zSessionToken, zTableToken } from "@/lib/security/zod-fields";
import { createAdminClient } from "@/lib/supabase/admin";

/** ADR-019 Phase B — single guest read model (FACE). */
export const GET = withErrorHandler("denis-view-get", async (req, _ctx) => {
  const tableToken = req.nextUrl.searchParams.get("tableToken");
  const orgId =
    typeof tableToken === "string"
      ? await resolveOrgIdFromTableToken(tableToken)
      : null;
  const limited = await withGuestRateLimits(req, "sessions", orgId);
  if (limited) return limited;

  const sessionToken = req.nextUrl.searchParams.get("sessionToken");
  if (!sessionToken) {
    return apiError("Unauthorized.", 401);
  }

  if (!tableToken) {
    return apiError("Invalid table.", 400);
  }

  const sessionParsed = zSessionToken().safeParse(sessionToken);
  if (!sessionParsed.success) {
    return apiError("Unauthorized.", 401);
  }

  const tableParsed = zTableToken().safeParse(tableToken);
  if (!tableParsed.success) {
    return apiError("Invalid table.", 400);
  }

  const admin = createAdminClient();
  const sessionResult = await validateTableSession(
    admin,
    tableParsed.data,
    sessionParsed.data
  );

  if ("error" in sessionResult) {
    return apiError(sessionResult.error, sessionResult.status);
  }

  const { session, table } = sessionResult.data;

  const { data: venueRow } = await admin
    .from("locations")
    .select("organization:organizations!inner(name)")
    .eq("id", table.location_id)
    .maybeSingle();

  const venueName =
    (venueRow as { organization?: { name?: string } } | null)?.organization
      ?.name ?? "";

  const loaded = await loadTableSessionView(admin, {
    sessionId: session.id,
    tableId: table.id,
    locationId: table.location_id,
    tableToken: tableParsed.data,
    venueName,
  });

  if (!loaded) {
    return apiError("View not available.", 404);
  }

  return apiSuccess({
    viewVersion: loaded.view.version,
    view: loaded.view,
    scene: loaded.scene,
  });
});
