import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import {
  executeStationGeneralVoiceTool,
  isStationGeneralVoiceToolName,
} from "@/lib/denis/agentic/station-general-voice-tool-catalog";
import { withStaffRateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/security/sanitize";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

const schema = z.object({
  toolName: z.string().min(1).max(80),
  locationId: z.string().uuid(),
  station: z.enum(["kitchen", "bar"]),
  args: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Called by the browser client when the staff-initiated Realtime session
 * (general-token/route.ts) emits a function_call event — same relay shape
 * as station-voice/execute-tool, just re-validated against a locationId
 * instead of a station_questions row since no question exists here.
 */
export const POST = withErrorHandler(
  "denis-station-voice-general-execute-tool-post",
  async (req, _ctx) => {
    const limited = await withStaffRateLimit(req);
    if (limited) return limited;

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return apiError("Invalid input.", 400, parsed.error.flatten());
    }

    if (!isStationGeneralVoiceToolName(parsed.data.toolName)) {
      return apiError("Unknown tool.", 400);
    }

    if (!isUuid(parsed.data.locationId)) {
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
      .select("id, org_id, location_id, role")
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
      role: string;
    };

    const admin = createAdminClient();
    const { data: location } = await admin
      .from("locations")
      .select("org_id")
      .eq("id", parsed.data.locationId)
      .maybeSingle();

    if (
      !location ||
      (location as { org_id: string }).org_id !== staffRow.org_id ||
      (staffRow.location_id && staffRow.location_id !== parsed.data.locationId)
    ) {
      return apiError("Unauthorized.", 401);
    }

    const result = await executeStationGeneralVoiceTool(
      parsed.data.toolName,
      {
        admin,
        locationId: parsed.data.locationId,
        orgId: staffRow.org_id,
        staffId: staffRow.id,
        staffRole: staffRow.role,
        station: parsed.data.station,
      },
      parsed.data.args ?? {}
    );

    return apiSuccess({ result });
  }
);
