import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { acknowledgeRelayDelivery } from "@/lib/denis/stations/station-relay-messages";
import { withStaffRateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/security/sanitize";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

/** Marks a relay reply as delivered (spoken) back to the station that originally asked — stops it from being spoken again. */
export const POST = withErrorHandler(
  "station-relay-acknowledge-post",
  async (req, ctx) => {
    const limited = await withStaffRateLimit(req);
    if (limited) return limited;

    const { id } = await ctx.params;
    if (!isUuid(id)) {
      return apiError("Invalid relay id.", 400);
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
    const { data: relay } = await admin
      .from("denis_station_relay_messages")
      .select("id, location_id")
      .eq("id", id)
      .maybeSingle();

    if (!relay) {
      return apiError("Relay message not found.", 404);
    }

    const relayRow = relay as { id: string; location_id: string };

    const { data: location } = await admin
      .from("locations")
      .select("org_id")
      .eq("id", relayRow.location_id)
      .maybeSingle();

    if (
      !location ||
      (location as { org_id: string }).org_id !== staffRow.org_id ||
      (staffRow.location_id && staffRow.location_id !== relayRow.location_id)
    ) {
      return apiError("Unauthorized.", 401);
    }

    const ok = await acknowledgeRelayDelivery(admin, { relayId: relayRow.id });
    return apiSuccess({ ok });
  }
);
