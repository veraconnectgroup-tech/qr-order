import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import { withStaffRateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/security/sanitize";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

/**
 * ADR-053 P1 — tells the station tablet whether to arm the local
 * hands-free wake-word ear (use-denis-station-ear.ts). Read-only config
 * lookup; the actual Realtime session still goes through general-token
 * with its own full auth when the wake word fires.
 */
export const GET = withErrorHandler(
  "denis-station-voice-hands-free-get",
  async (req, _ctx) => {
    const limited = await withStaffRateLimit(req);
    if (limited) return limited;

    const locationId = req.nextUrl.searchParams.get("locationId");
    if (!locationId || !isUuid(locationId)) {
      return apiError("Invalid location.", 400);
    }

    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return apiError("Unauthorized.", 401);
    }

    const { data: staff } = await supabase
      .from("staff")
      .select("id, org_id, location_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .is("deleted_at", null)
      .maybeSingle();

    if (!staff) {
      return apiError("Unauthorized.", 401);
    }

    const staffRow = staff as {
      id: string;
      org_id: string;
      location_id: string | null;
    };

    const admin = createAdminClient();
    const { data: location } = await admin
      .from("locations")
      .select("org_id")
      .eq("id", locationId)
      .maybeSingle();

    if (
      !location ||
      (location as { org_id: string }).org_id !== staffRow.org_id ||
      (staffRow.location_id && staffRow.location_id !== locationId)
    ) {
      return apiError("Unauthorized.", 401);
    }

    const config = await loadConciergeConfigForLocation(locationId);
    return apiSuccess({
      handsFreeWakeWordEnabled:
        config.surfaces.voiceStaffEnabled &&
        config.ops.stationQuestions.handsFreeWakeWordEnabled,
    });
  }
);
