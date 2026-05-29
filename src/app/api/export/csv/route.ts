import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { auditLog } from "@/lib/audit/log";
import { requireStaffPermission } from "@/lib/auth/require-staff-permission";
import { getStaffLocationId } from "@/lib/auth/session";
import { formatAnalyticsIsoDate } from "@/lib/analytics/date-range";
import {
  ordersCsvFilename,
  ordersToCsv,
} from "@/lib/export/orders-csv";
import {
  fetchOrdersForCsvExport,
  parseHistoryFilters,
  type HistorySearchParams,
} from "@/lib/orders/history-filters";
import { withRateLimit } from "@/lib/rate-limit";
import type { OrderWithDetails } from "@/types";

export const GET = withErrorHandler("export-csv-get", async (req, _ctx) => {
  const limited = await withRateLimit(req, "export");
  if (limited) return limited;

  const staff = await requireStaffPermission("analytics.read");

  const locationId = await getStaffLocationId(staff);
  if (!locationId) {
    return apiError("No location assigned.", 400);
  }

  const sp = req.nextUrl.searchParams;
  const filters = parseHistoryFilters({
    preset: sp.get("preset") ?? undefined,
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
    status: sp.get("status") ?? undefined,
    payment: sp.get("payment") ?? undefined,
    source: sp.get("source") ?? undefined,
    q: sp.get("q") ?? undefined,
  } satisfies HistorySearchParams);

  const { data, error } = await fetchOrdersForCsvExport(locationId, filters);

  if (error) {
    return apiError(error.message, 500);
  }

  const csv = ordersToCsv((data ?? []) as OrderWithDetails[]);
  const filename = ordersCsvFilename(
    formatAnalyticsIsoDate(filters.range.start),
    formatAnalyticsIsoDate(filters.range.end)
  );

  await auditLog({
    orgId: staff.org_id,
    userId: staff.user_id,
    action: "export",
    entityType: "orders_csv",
    newValue: {
      filename,
      from: formatAnalyticsIsoDate(filters.range.start),
      to: formatAnalyticsIsoDate(filters.range.end),
    },
    request: req,
  });

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
});
