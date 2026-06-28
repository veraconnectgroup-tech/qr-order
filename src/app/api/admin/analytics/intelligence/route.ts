import { NextResponse } from "next/server";
import {
  getPreviousAnalyticsRange,
  resolveAnalyticsDateRange,
} from "@/lib/analytics/date-range";
import { loadAdminIntelligenceSnapshot } from "@/lib/analytics/admin-intelligence/load-intelligence";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { withStaffRateLimit } from "@/lib/rate-limit";

export const GET = withErrorHandler(
  "admin-analytics-intelligence-get",
  async (req, _ctx) => {
    const limited = await withStaffRateLimit(req);
    if (limited) return limited;

    const { searchParams } = new URL(req.url);
    const range = resolveAnalyticsDateRange({
      preset: searchParams.get("preset") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
    });

    const snapshot = await loadAdminIntelligenceSnapshot(range);
    if (!snapshot) {
      return NextResponse.json({ error: "No location assigned." }, { status: 400 });
    }

    return NextResponse.json({
      snapshot,
      previousRange: getPreviousAnalyticsRange(range),
    });
  }
);
