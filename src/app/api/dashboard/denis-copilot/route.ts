import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { getCurrentStaff, getStaffLocationId } from "@/lib/auth/session";
import { noCache } from "@/lib/cache/headers";
import { loadStaffCopilotSnapshot } from "@/lib/denis/venue/copilot";
import { withRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export const GET = withErrorHandler(
  "dashboard-denis-copilot-get",
  async (req, _ctx) => {
    const limited = await withRateLimit(req, "default");
    if (limited) return limited;

    const staff = await getCurrentStaff();
    if (!staff) {
      return apiError("Unauthorized.", 401, undefined, noCache());
    }

    const locationId = await getStaffLocationId(staff);
    if (!locationId) {
      return apiError("No location assigned.", 400, undefined, noCache());
    }

    const admin = createAdminClient();
    const payload = await loadStaffCopilotSnapshot(admin, {
      locationId,
      staffRole: staff.role,
    });

    return apiSuccess(payload, 200, noCache());
  }
);
