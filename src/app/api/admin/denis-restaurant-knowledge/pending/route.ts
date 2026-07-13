import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { getStaffLocationId, requireAdmin } from "@/lib/auth/session";
import { listPendingRestaurantKnowledgeProposals } from "@/lib/denis/knowledge/restaurant-knowledge-store";
import { withStaffRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

/** Rule-proposal state machine (00167 migration) — pending owner/manager sign-off. */
export const GET = withErrorHandler(
  "admin-denis-restaurant-knowledge-pending-get",
  async (req, _ctx) => {
    const limited = await withStaffRateLimit(req);
    if (limited) return limited;

    const staff = await requireAdmin();
    const locationId = await getStaffLocationId(staff);
    if (!locationId) {
      return apiError("No location assigned.", 400);
    }

    const admin = createAdminClient();
    const proposals = await listPendingRestaurantKnowledgeProposals(admin, locationId);
    return apiSuccess({ proposals });
  }
);
