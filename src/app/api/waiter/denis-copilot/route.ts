import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { getCurrentStaff, getStaffLocationId } from "@/lib/auth/session";
import { noCache } from "@/lib/cache/headers";
import { loadWaiterCopilotSnapshot } from "@/lib/denis/venue/copilot";
import { withStaffRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export const GET = withErrorHandler(
  "waiter-denis-copilot-get",
  async (req, _ctx) => {
    const limited = await withStaffRateLimit(req);
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
    const payload = await loadWaiterCopilotSnapshot(admin, {
      locationId,
      orgId: staff.org_id,
      staffRole: staff.role,
    });

    return apiSuccess(payload, 200, noCache());
  }
);
