export const maxDuration = 15;

import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { auditLog } from "@/lib/audit/log";
import { requireStaffPermission } from "@/lib/auth/require-staff-permission";
import {
  datevExportFilename,
  generateDatevExport,
  parseDatevDateRange,
} from "@/lib/export/datev";
import { withRateLimit } from "@/lib/rate-limit";

export const GET = withErrorHandler("export-datev-get", async (req, _ctx) => {
  const limited = await withRateLimit(req, "export");
  if (limited) return limited;

  const staff = await requireStaffPermission("fiscal.export.accounting");

  const fromParam = req.nextUrl.searchParams.get("from");
  const toParam = req.nextUrl.searchParams.get("to");
  const parsed = parseDatevDateRange(fromParam, toParam);

  if ("error" in parsed) {
    return apiError(parsed.error, 400);
  }

  const csv = await generateDatevExport(
    staff.org_id,
    parsed.from,
    parsed.to
  );

  const filename = datevExportFilename(parsed.from, parsed.to);

  await auditLog({
    orgId: staff.org_id,
    userId: staff.user_id,
    action: "export",
    entityType: "datev_export",
    newValue: { filename, from: parsed.from, to: parsed.to },
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
