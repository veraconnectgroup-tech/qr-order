import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { getStaffLocationId, requireAdmin } from "@/lib/auth/session";
import {
  addRestaurantKnowledge,
  loadActiveRestaurantKnowledge,
} from "@/lib/denis/knowledge/restaurant-knowledge-store";
import { withStaffRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const addSchema = z.object({
  text: z.string().trim().min(1).max(500),
});

/**
 * Owner/manager-facing CRUD for durable restaurant house knowledge —
 * see restaurant-knowledge-store.ts's own docstring for what this is and
 * isn't. List + add here; archive is the [id] sub-route.
 */
export const GET = withErrorHandler(
  "admin-denis-restaurant-knowledge-get",
  async (req, _ctx) => {
    const limited = await withStaffRateLimit(req);
    if (limited) return limited;

    const staff = await requireAdmin();
    const locationId = await getStaffLocationId(staff);
    if (!locationId) {
      return apiError("No location assigned.", 400);
    }

    const admin = createAdminClient();
    const entries = await loadActiveRestaurantKnowledge(admin, locationId);
    return apiSuccess({ entries });
  }
);

export const POST = withErrorHandler(
  "admin-denis-restaurant-knowledge-post",
  async (req, _ctx) => {
    const limited = await withStaffRateLimit(req);
    if (limited) return limited;

    const staff = await requireAdmin();
    const locationId = await getStaffLocationId(staff);
    if (!locationId) {
      return apiError("No location assigned.", 400);
    }

    const parsed = addSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return apiError("Invalid input.", 400, parsed.error.flatten());
    }

    const admin = createAdminClient();
    const result = await addRestaurantKnowledge(admin, {
      locationId,
      text: parsed.data.text,
      source: "admin_text",
      createdByStaffId: staff.id,
    });

    if (!result.ok) {
      return apiError("Could not save.", 400);
    }

    return apiSuccess({ id: result.id });
  }
);
