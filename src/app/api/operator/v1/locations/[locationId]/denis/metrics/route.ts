import { apiError } from "@/lib/api-response";
import { projectDenisLocationMetrics } from "@/lib/operator/projections/denis-metrics";
import { operatorJson, withOperatorReadRoute } from "@/lib/operator/route-handler";
import { createAdminClient } from "@/lib/supabase/admin";

export const GET = withOperatorReadRoute(
  "operator-v1-denis-metrics-get",
  async (req, ctx, auth) => {
    const { locationId } = await ctx.params;
    const period = req.nextUrl.searchParams.get("period");

    const admin = createAdminClient();
    const metrics = await projectDenisLocationMetrics(admin, {
      orgId: auth.orgId,
      locationId,
      period,
    });

    if (!metrics) {
      return apiError("Location not found.", 404);
    }

    return operatorJson(metrics);
  }
);
