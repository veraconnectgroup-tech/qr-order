import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { getCurrentStaff } from "@/lib/auth/session";
import {
  datevExportFilename,
  generateDatevExport,
  parseDatevDateRange,
} from "@/lib/export/datev";
import { logger } from "@/lib/logger";
import { withRateLimit } from "@/lib/rate-limit";

async function requireExportStaff() {
  const staff = await getCurrentStaff();
  if (!staff || !["owner", "manager"].includes(staff.role)) {
    return null;
  }
  return staff;
}

export async function GET(req: NextRequest) {
  try {
    const limited = await withRateLimit(req, "export");
    if (limited) return limited;

    const staff = await requireExportStaff();
    if (!staff) {
      return apiError("Unauthorized.", 401);
    }

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

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    logger.error("DATEV export error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError("DATEV export could not be generated.", 500);
  }
}
