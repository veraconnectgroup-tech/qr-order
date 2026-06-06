import { apiError } from "@/lib/api-response";
import { projectLocationOrders } from "@/lib/operator/projections/list-location-orders";
import { operatorJson, withOperatorReadRoute } from "@/lib/operator/route-handler";
import { createAdminClient } from "@/lib/supabase/admin";

export const GET = withOperatorReadRoute(
  "operator-v1-location-orders-get",
  async (req, ctx, auth) => {
    const { locationId } = await ctx.params;
    const params = req.nextUrl.searchParams;
    const limitRaw = params.get("limit");
    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;

    const admin = createAdminClient();
    const orders = await projectLocationOrders(admin, {
      orgId: auth.orgId,
      locationId,
      period: params.get("period"),
      status: params.get("status"),
      limit: Number.isFinite(limit) ? limit : undefined,
    });

    if (!orders) {
      return apiError("Location not found.", 404);
    }

    return operatorJson({ orders });
  }
);
