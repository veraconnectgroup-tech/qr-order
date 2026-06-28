import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import { loadTableParty } from "@/lib/denis/venue/party/party-store";
import type { GuestManualCartSnapshot } from "@/lib/guest/manual-cart-snapshot";
import { withGuestRateLimits } from "@/lib/rate-limit";
import { resolveOrgIdFromTableToken } from "@/lib/rate-limit/org-context";
import { zSessionToken, zTableToken } from "@/lib/security/zod-fields";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateTableSession } from "@/lib/orders/validate-table-session";

function asManualSnapshot(value: unknown): GuestManualCartSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const snapshot = value as GuestManualCartSnapshot;
  if (!Array.isArray(snapshot.items)) return null;
  return snapshot;
}

/** Guest party cart read model for shared_cart multi-device sync. */
export const GET = withErrorHandler("guest-party-cart-get", async (req, _ctx) => {
  const tableToken = req.nextUrl.searchParams.get("tableToken");
  const sessionToken = req.nextUrl.searchParams.get("sessionToken");

  const orgId =
    typeof tableToken === "string"
      ? await resolveOrgIdFromTableToken(tableToken)
      : null;
  const limited = await withGuestRateLimits(req, "sessions", orgId);
  if (limited) return limited;

  if (!sessionToken || !tableToken) {
    return apiError("Unauthorized.", 401);
  }

  const sessionParsed = zSessionToken().safeParse(sessionToken);
  const tableParsed = zTableToken().safeParse(tableToken);
  if (!sessionParsed.success || !tableParsed.success) {
    return apiError("Unauthorized.", 401);
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
  const config = await loadConciergeConfigForLocation(table.location_id);
  const partyMode = config.party.mode;

  const party = await loadTableParty(admin, {
    tableSessionId: session.id,
    partyMode,
  });

  const devices =
    party?.devices.map((device) => ({
      deviceFingerprint: device.deviceFingerprint,
      revision: device.manualCartRevision,
      snapshot: asManualSnapshot(device.manualCartSnapshot),
    })) ?? [];

  const mergedRevision = devices.reduce(
    (max, device) => Math.max(max, device.revision),
    0
  );

  return apiSuccess({
    partyMode,
    tableSessionId: session.id,
    devices,
    mergedRevision,
  });
});
