import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { formatAnalyticsIsoDate } from "@/lib/analytics/date-range";
import { parseDenisRoiRange } from "@/lib/dashboard/denis-roi";
import {
  fetchOrgAnalytics,
  orgAnalyticsToCsv,
} from "@/lib/dashboard/org-analytics";
import { getCurrentStaff } from "@/lib/auth/session";
import { noCache } from "@/lib/cache/headers";
import { withRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export const GET = withErrorHandler(
  "dashboard-org-analytics-get",
  async (req, _ctx) => {
    const limited = await withRateLimit(req, "default");
    if (limited) return limited;

    const staff = await getCurrentStaff();
    if (!staff) {
      return apiError("Unauthorized.", 401, undefined, noCache());
    }

    if (staff.role !== "owner") {
      return apiError("Forbidden.", 403, undefined, noCache());
    }

    const params = req.nextUrl.searchParams;
    const range = parseDenisRoiRange({
      preset: params.get("range") ?? "30d",
      from: params.get("from") ?? undefined,
      to: params.get("to") ?? undefined,
    });

    if (params.get("format") === "csv") {
      const admin = createAdminClient();
      const data = await fetchOrgAnalytics(admin, {
        orgId: staff.org_id,
        fromDate: formatAnalyticsIsoDate(range.start),
        toDate: formatAnalyticsIsoDate(range.end),
      });
      const csv = orgAnalyticsToCsv(data);
      return new Response(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="org-analytics-${data.period.end}.csv"`,
          ...noCache(),
        },
      });
    }

    const admin = createAdminClient();
    const payload = await fetchOrgAnalytics(admin, {
      orgId: staff.org_id,
      fromDate: formatAnalyticsIsoDate(range.start),
      toDate: formatAnalyticsIsoDate(range.end),
    });

    return apiSuccess(payload, 200, noCache());
  }
);
