import { apiError } from "@/lib/api-response";
import { projectLocationSummary } from "@/lib/operator/projections/location-summary";
import { operatorJson, withOperatorReadRoute } from "@/lib/operator/route-handler";
import { createAdminClient } from "@/lib/supabase/admin";

export const GET = withOperatorReadRoute(
  "operator-v1-location-summary-get",
  async (req, ctx, auth) => {
    const { locationId } = await ctx.params;
    const period = req.nextUrl.searchParams.get("period");

    const admin = createAdminClient();
    const summary = await projectLocationSummary(admin, {
      orgId: auth.orgId,
      locationId,
      period,
    });

    if (!summary) {
      return apiError("Location not found.", 404);
    }

    return operatorJson(summary);
  }
);
