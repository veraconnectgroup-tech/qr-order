import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { getCurrentStaff, getStaffLocationId } from "@/lib/auth/session";
import { noCache } from "@/lib/cache/headers";
import { loadWaiterTableSessionView } from "@/lib/denis/venue/copilot";
import { withStaffRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export const GET = withErrorHandler(
  "waiter-denis-copilot-table-get",
  async (req, ctx) => {
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

    const { tableId } = await ctx.params;
    const admin = createAdminClient();
    const payload = await loadWaiterTableSessionView(admin, {
      locationId,
      tableId,
    });

    if (!payload) {
      return apiError("Table not found.", 404, undefined, noCache());
    }

    return apiSuccess(payload, 200, noCache());
  }
);
