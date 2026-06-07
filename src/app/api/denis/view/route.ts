import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import {
  getDemoGuestDenisView,
  isDemoGuestDenisSession,
} from "@/lib/demo-guest";
import { ensureSharedAiSessionForTableSession } from "@/lib/denis/loop/ensure-shared-ai-session";
import { loadTableSessionView } from "@/lib/denis/loop/load-table-session-view";
import type { MenuLocale } from "@/lib/i18n/translations";
import { MENU_LOCALES } from "@/lib/i18n/translations";
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

  if (isDemoGuestDenisSession(tableParsed.data, sessionParsed.data)) {
    return apiSuccess(getDemoGuestDenisView());
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
    .select(
      "ai_concierge_enabled, menu_locale, default_locale, organization:organizations!inner(id, name)"
    )
    .eq("id", table.location_id)
    .maybeSingle();

  const venue = venueRow as {
    ai_concierge_enabled: boolean;
    menu_locale: string | null;
    default_locale: string | null;
    organization: { id: string; name: string };
  } | null;

  const venueName = venue?.organization.name ?? "";

  if (venue?.ai_concierge_enabled) {
    const rawLocale = venue.default_locale ?? venue.menu_locale ?? "de";
    const language = (
      MENU_LOCALES.includes(rawLocale as MenuLocale) ? rawLocale : "de"
    ) as MenuLocale;

    await ensureSharedAiSessionForTableSession(admin, {
      sessionId: session.id,
      locationId: table.location_id,
      tableId: table.id,
      tableToken: tableParsed.data,
      orgId: venue.organization.id,
      language,
    });
  }

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
