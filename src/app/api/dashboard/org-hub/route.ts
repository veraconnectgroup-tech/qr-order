import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { requireOwner } from "@/lib/auth/session";
import { fetchCrossLocationAnalytics } from "@/lib/org/cross-location-analytics";
import { fetchOrgHub } from "@/lib/org/org-hub";
import { createAdminClient } from "@/lib/supabase/admin";
import { withStaffRateLimit } from "@/lib/rate-limit";

export const GET = withErrorHandler("dashboard-org-hub-get", async (req, _ctx) => {
  const limited = await withStaffRateLimit(req);
  if (limited) return limited;

  const staff = await requireOwner();
  const admin = createAdminClient();

  const periodDays = Number(req.nextUrl.searchParams.get("days") ?? "30");
  const leftId = req.nextUrl.searchParams.get("left");
  const rightId = req.nextUrl.searchParams.get("right");

  const compareLocationIds =
    leftId && rightId ? ([leftId, rightId] as [string, string]) : undefined;

  const [hub, crossLocation] = await Promise.all([
    fetchOrgHub(admin, staff.org_id, {
      periodDays: Number.isFinite(periodDays) ? periodDays : 30,
      compareLocationIds,
    }),
    fetchCrossLocationAnalytics(
      admin,
      staff.org_id,
      Number.isFinite(periodDays) ? periodDays : 30
    ),
  ]);

  return apiSuccess({ hub, crossLocation });
});
