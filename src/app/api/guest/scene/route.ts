import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { validateTableSession } from "@/lib/orders/validate-table-session";
import { withGuestRateLimits } from "@/lib/rate-limit";
import { resolveOrgIdFromTableToken } from "@/lib/rate-limit/org-context";
import {
  loadGuestSceneBySessionId,
  refreshGuestScene,
} from "@/lib/scene/refresh-guest-scene";
import { zSessionToken, zTableToken } from "@/lib/security/zod-fields";
import { createAdminClient } from "@/lib/supabase/admin";

/** ADR-016 SC-3 — read versioned Scene for guest UI. */
export const GET = withErrorHandler("guest-scene-get", async (req, _ctx) => {
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

  const sessionId = sessionResult.data.session.id;
  let scene = await loadGuestSceneBySessionId(admin, sessionId);

  if (!scene) {
    scene = await refreshGuestScene(admin, { sessionId });
  }

  if (!scene) {
    return apiError("Scene not available.", 404);
  }

  return apiSuccess({ scene });
});
