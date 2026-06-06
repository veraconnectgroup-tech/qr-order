import { apiError } from "@/lib/api-response";
import { projectCommerceInsights } from "@/lib/operator/projections/commerce-insights";
import { operatorJson, withOperatorReadRoute } from "@/lib/operator/route-handler";
import { createAdminClient } from "@/lib/supabase/admin";

export const GET = withOperatorReadRoute(
  "operator-v1-commerce-insights-get",
  async (req, ctx, auth) => {
    const { locationId } = await ctx.params;
    const params = req.nextUrl.searchParams;

    const admin = createAdminClient();
    const insights = await projectCommerceInsights(admin, {
      orgId: auth.orgId,
      locationId,
      period: params.get("period"),
      include: params.get("include"),
    });

    if (!insights) {
      return apiError("Location not found.", 404);
    }

    return operatorJson(insights);
  }
);
