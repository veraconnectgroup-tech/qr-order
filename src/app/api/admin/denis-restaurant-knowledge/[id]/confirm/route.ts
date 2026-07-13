import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { getStaffLocationId, requireAdmin } from "@/lib/auth/session";
import { confirmRestaurantRuleProposal } from "@/lib/denis/knowledge/restaurant-knowledge-store";
import { withStaffRateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/security/sanitize";
import { createAdminClient } from "@/lib/supabase/admin";

export const POST = withErrorHandler(
  "admin-denis-restaurant-knowledge-confirm",
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
    const result = await confirmRestaurantRuleProposal(admin, {
      id,
      locationId,
      confirmedByStaffId: staff.id,
    });

    if (!result.ok) {
      return apiError("Could not confirm.", 400, { reason: result.error });
    }

    return apiSuccess({ ok: true });
  }
);
