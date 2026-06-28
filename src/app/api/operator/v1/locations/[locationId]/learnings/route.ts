import { apiError } from "@/lib/api-response";
import { projectLocationLearnings } from "@/lib/operator/projections/location-learnings";
import { operatorJson, withOperatorReadRoute } from "@/lib/operator/route-handler";
import { createAdminClient } from "@/lib/supabase/admin";

export const GET = withOperatorReadRoute(
  "operator-v1-location-learnings-get",
  async (req, ctx, auth) => {
    const { locationId } = await ctx.params;
    const period = req.nextUrl.searchParams.get("period");

    const admin = createAdminClient();
    const learnings = await projectLocationLearnings(admin, {
      orgId: auth.orgId,
      locationId,
      period,
    });

    if (!learnings) {
      return apiError("Location not found.", 404);
    }

    return operatorJson(learnings);
  }
);
