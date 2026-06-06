import { apiError } from "@/lib/api-response";
import { projectOperatorOrderDetail } from "@/lib/operator/projections/order-detail";
import { operatorJson, withOperatorReadRoute } from "@/lib/operator/route-handler";
import { createAdminClient } from "@/lib/supabase/admin";

export const GET = withOperatorReadRoute(
  "operator-v1-location-order-detail-get",
  async (_req, ctx, auth) => {
    const { locationId, orderId } = await ctx.params;

    const admin = createAdminClient();
    const order = await projectOperatorOrderDetail(admin, {
      orgId: auth.orgId,
      locationId,
      orderId,
    });

    if (!order) {
      return apiError("Order not found.", 404);
    }

    return operatorJson({ order });
  }
);
