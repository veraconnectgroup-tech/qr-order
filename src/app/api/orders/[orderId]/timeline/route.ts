import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { loadOrderTimeline } from "@/lib/orders/order-timeline";
import { withStaffRateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/security/sanitize";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

type StaffAccess = {
  order: { id: string; location_id: string };
  staff: { org_id: string; location_id: string | null };
};

async function verifyStaffOrderAccess(
  orderId: string
): Promise<StaffAccess | null> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id, location_id")
    .eq("id", orderId)
    .single();

  if (!order) return null;

  const orderRow = order as StaffAccess["order"];

  const { data: staff } = await supabase
    .from("staff")
    .select("id, user_id, org_id, location_id, role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (!staff) return null;

  const staffRow = staff as StaffAccess["staff"];

  const { data: location } = await admin
    .from("locations")
    .select("org_id")
    .eq("id", orderRow.location_id)
    .single();

  if (!location) return null;

  if ((location as { org_id: string }).org_id !== staffRow.org_id) {
    return null;
  }

  if (
    staffRow.location_id &&
    staffRow.location_id !== orderRow.location_id
  ) {
    return null;
  }

  return { order: orderRow, staff: staffRow };
}

export const GET = withErrorHandler(
  "orders-orderId-timeline-get",
  async (req, ctx) => {
    const limited = await withStaffRateLimit(req);
    if (limited) return limited;

    const { orderId } = await ctx.params;

    if (!isUuid(orderId)) {
      return apiError("Invalid order id.", 400);
    }

    const access = await verifyStaffOrderAccess(orderId);
    if (!access) {
      return apiError("Unauthorized.", 401);
    }

    const admin = createAdminClient();
    const timeline = await loadOrderTimeline(admin, orderId);

    return apiSuccess({ timeline });
  }
);
