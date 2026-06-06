import { apiError } from "@/lib/api-response";
import { projectFiscalDailyClosing } from "@/lib/operator/projections/fiscal-daily-closing";
import { operatorJson, withOperatorReadRoute } from "@/lib/operator/route-handler";
import { createAdminClient } from "@/lib/supabase/admin";

export const GET = withOperatorReadRoute(
  "operator-v1-fiscal-daily-closing-get",
  async (req, ctx, auth) => {
    const { locationId } = await ctx.params;
    const businessDate = req.nextUrl.searchParams.get("date");

    if (!businessDate) {
      return apiError("Query parameter date is required (YYYY-MM-DD).", 400);
    }

    const admin = createAdminClient();
    const closing = await projectFiscalDailyClosing(admin, {
      orgId: auth.orgId,
      locationId,
      businessDate,
    });

    if (!closing) {
      return apiError("Daily closing not found for this date.", 404);
    }

    return operatorJson({ closing });
  }
);
