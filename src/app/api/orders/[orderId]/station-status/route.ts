import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { safeJsonParse } from "@/lib/api/safe-json";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import {
  assertRoleCanPatchStation,
  patchStationStatus,
  STATION_KINDS,
  STATION_STATUSES,
  type StationKind,
  type StationStatus,
} from "@/lib/orders/station-states";
import { scheduleDenisWorldSignal } from "@/lib/outbox/enqueue-denis-world-signal";
import { withStaffRateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/security/sanitize";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

const patchSchema = z.object({
  station: z.enum(STATION_KINDS),
  status: z.enum(STATION_STATUSES),
});

type StaffAccess = {
  order: {
    id: string;
    location_id: string;
    status: string;
    session_id: string | null;
  };
  staff: {
    id: string;
    org_id: string;
    location_id: string | null;
    role: string;
  };
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
    .select("id, location_id, status, session_id")
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

export const PATCH = withErrorHandler(
  "orders-orderId-station-status-patch",
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

    const body = await safeJsonParse(req);
    if (!body) {
      return apiError("Invalid JSON.", 400);
    }

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid request body.", 400);
    }

    const { station, status } = parsed.data;

    const admin = createAdminClient();
    const { data: stationRow } = await admin
      .from("order_station_states")
      .select("status")
      .eq("order_id", orderId)
      .eq("station", station)
      .maybeSingle();

    if (!stationRow) {
      return apiError("Station state not found for this order.", 404);
    }

    const currentStatus = (stationRow as { status: StationStatus }).status;

    const roleCheck = assertRoleCanPatchStation({
      role: access.staff.role as Parameters<
        typeof assertRoleCanPatchStation
      >[0]["role"],
      station: station as StationKind,
      fromStatus: currentStatus,
      toStatus: status as StationStatus,
    });

    if (!roleCheck.ok) {
      return apiError(roleCheck.reason, 403);
    }

    const result = await patchStationStatus(admin, {
      orderId,
      station: station as StationKind,
      status: status as StationStatus,
      staffId: access.staff.id,
    });

    if (!result.ok) {
      if (result.error === "not_found") {
        return apiError("Order not found.", 404);
      }
      if (result.error === "station_not_found") {
        return apiError("Station state not found for this order.", 404);
      }
      if (result.error === "locked") {
        return apiError("Station state is locked.", 409);
      }
      if (result.error === "invalid_transition") {
        return apiError(
          result.message ?? "Invalid station status transition.",
          409
        );
      }
      return apiError(result.message ?? "Could not update station status.", 500);
    }

    if (
      status === "ready" &&
      access.order.session_id &&
      result.globalStatus !== "ready" &&
      result.globalStatus !== "delivered"
    ) {
      const config = await loadConciergeConfigForLocation(
        access.order.location_id
      );
      const stationTellEnabled =
        config.ops.stationAwareTell || config.ops.stationQuestions.enabled;
      if (stationTellEnabled) {
        scheduleDenisWorldSignal({
          signal: "commerce.order_status",
          orderId,
          sessionId: access.order.session_id,
          status: result.globalStatus,
          previousStatus: access.order.status,
          stationTell: { station: station as "kitchen" | "bar" },
        });
      }
    }

    return apiSuccess({
      station: result.station,
      stationStatus: result.stationStatus,
      globalStatus: result.globalStatus,
      orderId: result.orderId,
    });
  }
);
