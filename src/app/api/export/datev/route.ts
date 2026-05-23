import { NextRequest, NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth/session";
import {
  datevExportFilename,
  generateDatevExport,
  parseDatevDateRange,
} from "@/lib/export/datev";
import { logger } from "@/lib/logger";
import { withRateLimitScope } from "@/lib/rate-limit";

async function requireExportStaff() {
  const staff = await getCurrentStaff();
  if (!staff || !["owner", "manager"].includes(staff.role)) {
    return null;
  }
  return staff;
}

export async function GET(req: NextRequest) {
  try {
    const limited = await withRateLimitScope(req, "export");
    if (limited) return limited;

    const staff = await requireExportStaff();
    if (!staff) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const fromParam = req.nextUrl.searchParams.get("from");
    const toParam = req.nextUrl.searchParams.get("to");
    const parsed = parseDatevDateRange(fromParam, toParam);

    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
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
    return NextResponse.json(
      { error: "DATEV export could not be generated." },
      { status: 500 }
    );
  }
}
