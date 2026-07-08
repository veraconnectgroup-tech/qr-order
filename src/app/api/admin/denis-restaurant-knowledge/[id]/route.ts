import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { getStaffLocationId, requireAdmin } from "@/lib/auth/session";
import { archiveRestaurantKnowledge } from "@/lib/denis/knowledge/restaurant-knowledge-store";
import { withStaffRateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/security/sanitize";
import { createAdminClient } from "@/lib/supabase/admin";

export const DELETE = withErrorHandler(
  "admin-denis-restaurant-knowledge-delete",
  async (req, ctx) => {
    const limited = await withStaffRateLimit(req);
    if (limited) return limited;

    const staff = await requireAdmin();
    const locationId = await getStaffLocationId(staff);
    if (!locationId) {
      return apiError("No location assigned.", 400);
    }

    const { id } = await ctx.params;
    if (!isUuid(id)) {
      return apiError("Invalid id.", 400);
    }

    const admin = createAdminClient();
    const ok = await archiveRestaurantKnowledge(admin, { id, locationId });
    if (!ok) {
      return apiError("Could not archive.", 400);
    }

    return apiSuccess({ ok: true });
  }
);
