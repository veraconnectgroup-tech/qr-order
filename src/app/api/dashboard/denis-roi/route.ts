import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { getCurrentStaff, getStaffLocationId } from "@/lib/auth/session";
import { noCache } from "@/lib/cache/headers";
import {
  fetchDenisRoiData,
  parseDenisRoiRange,
} from "@/lib/dashboard/denis-roi";
import { withRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export const GET = withErrorHandler(
  "dashboard-denis-roi-get",
  async (req, _ctx) => {
    const limited = await withRateLimit(req, "default");
    if (limited) return limited;

    const staff = await getCurrentStaff();
    if (!staff) {
      return apiError("Unauthorized.", 401, undefined, noCache());
    }

    if (!["owner", "manager"].includes(staff.role)) {
      return apiError("Forbidden.", 403, undefined, noCache());
    }

    const locationId = await getStaffLocationId(staff);
    if (!locationId) {
      return apiError("No location assigned.", 400, undefined, noCache());
    }

    const params = req.nextUrl.searchParams;
    const range = parseDenisRoiRange({
      preset: params.get("range") ?? "30d",
      from: params.get("from") ?? undefined,
      to: params.get("to") ?? undefined,
    });

    const admin = createAdminClient();
    const payload = await fetchDenisRoiData(admin, { locationId, range });

    return apiSuccess(payload, 200, noCache());
  }
);
