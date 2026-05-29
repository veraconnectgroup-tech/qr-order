export const maxDuration = 15;

import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { auditLog } from "@/lib/audit/log";
import { loadComplianceContextForLocation } from "@/lib/auth/compliance-guards";
import { requireStaffPermission } from "@/lib/auth/require-staff-permission";
import {
  dsfinvkExportFilename,
  generateDsfinvkExport,
  parseDsfinvkDateRange,
} from "@/lib/export/dsfinvk";
import { createAdminClient } from "@/lib/supabase/admin";
import { withRateLimit } from "@/lib/rate-limit";
import { zUuid } from "@/lib/security/zod-fields";

export const GET = withErrorHandler("export-dsfinvk-get", async (req, _ctx) => {
  const limited = await withRateLimit(req, "export");
  if (limited) return limited;

  const locationId = req.nextUrl.searchParams.get("locationId");
  if (!locationId || !zUuid().safeParse(locationId).success) {
    return apiError("Query parameter locationId is required.", 400);
  }

  const complianceCtx = await loadComplianceContextForLocation(locationId);
  const staff = await requireStaffPermission(
    "fiscal.export.audit",
    complianceCtx
  );

  const fromParam = req.nextUrl.searchParams.get("from");
  const toParam = req.nextUrl.searchParams.get("to");
  const parsed = parseDsfinvkDateRange(fromParam, toParam);

  if ("error" in parsed) {
    return apiError(parsed.error, 400);
  }

  const admin = createAdminClient();
  const { data: location } = await admin
    .from("locations")
    .select("id, name, org_id")
    .eq("id", locationId)
    .maybeSingle();

  const locationRow = location as {
    id: string;
    name: string;
    org_id: string;
  } | null;

  if (!locationRow || locationRow.org_id !== staff.org_id) {
    return apiError("Location not found.", 404);
  }

  const zipBuffer = await generateDsfinvkExport(
    staff.org_id,
    locationId,
    parsed.from,
    parsed.to
  );

  const filename = dsfinvkExportFilename(
    locationRow.name,
    parsed.from,
    parsed.to
  );

  await auditLog({
    orgId: staff.org_id,
    userId: staff.user_id,
    action: "export",
    entityType: "dsfinvk_export",
    newValue: {
      filename,
      locationId,
      from: parsed.from,
      to: parsed.to,
    },
    request: req,
  });

  return new NextResponse(new Uint8Array(zipBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
});
