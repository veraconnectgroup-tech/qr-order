import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { completeMission } from "@/lib/denis/missions/complete-mission";
import { withStaffRateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/security/sanitize";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

/** Waiter one-tap: mark a Denis mission done (mirrors table-bus-obligations' complete route). */
export const POST = withErrorHandler(
  "denis-missions-complete-post",
  async (req, ctx) => {
    const limited = await withStaffRateLimit(req);
    if (limited) return limited;

    const { id } = await ctx.params;
    if (!isUuid(id)) {
      return apiError("Invalid mission id.", 400);
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
    const { data: mission } = await admin
      .from("denis_missions")
      .select("id, org_id, location_id")
      .eq("id", id)
      .maybeSingle();

    if (!mission) {
      return apiError("Mission not found.", 404);
    }

    const missionRow = mission as {
      id: string;
      org_id: string;
      location_id: string;
    };

    if (
      missionRow.org_id !== staffRow.org_id ||
      (staffRow.location_id && staffRow.location_id !== missionRow.location_id)
    ) {
      return apiError("Unauthorized.", 401);
    }

    const result = await completeMission(admin, {
      missionId: missionRow.id,
      staffId: staffRow.id,
    });

    if (!result.ok) {
      if (result.error === "not_open") {
        return apiError("Misija je već rešena.", 409);
      }
      return apiError("Nije moguće sačuvati.", 500);
    }

    return apiSuccess({ mission: result.mission });
  }
);
