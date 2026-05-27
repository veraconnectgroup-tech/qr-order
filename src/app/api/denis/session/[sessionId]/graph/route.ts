import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { loadDenisSessionDebugGraph } from "@/lib/admin/denis-debug";
import { getCurrentStaff, getStaffLocationId } from "@/lib/auth/session";
import { noCache } from "@/lib/cache/headers";
import { withRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const sessionIdSchema = z.string().uuid();

export const GET = withErrorHandler(
  "denis-session-graph-get",
  async (req, ctx) => {
    const limited = await withRateLimit(req, "default");
    if (limited) return limited;

    const staff = await getCurrentStaff();
    if (!staff || !["owner", "manager"].includes(staff.role)) {
      return apiError("Unauthorized.", 401, undefined, noCache());
    }

    const locationId = await getStaffLocationId(staff);
    if (!locationId) {
      return apiError("No location assigned.", 400, undefined, noCache());
    }

    const params = await ctx.params;
    const parsed = sessionIdSchema.safeParse(params.sessionId);
    if (!parsed.success) {
      return apiError("Invalid session id.", 400, undefined, noCache());
    }

    const admin = createAdminClient();
    const graph = await loadDenisSessionDebugGraph(admin, {
      sessionId: parsed.data,
      locationId,
    });

    if (!graph) {
      return apiError("Session not found.", 404, undefined, noCache());
    }

    return apiSuccess(
      {
        sessionId: parsed.data,
        graph,
      },
      200,
      noCache()
    );
  }
);
