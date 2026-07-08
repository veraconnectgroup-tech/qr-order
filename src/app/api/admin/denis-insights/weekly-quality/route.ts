import { NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { requireAdmin } from "@/lib/auth/session";
import { buildWeeklyQualityReport } from "@/lib/denis/eval/continuous-eval-loop";
import { withStaffRateLimit } from "@/lib/rate-limit";

/**
 * The flywheel's "improve" step made visible: week-over-week Denis
 * quality trend from the already-running post-session eval loop
 * (continuous-eval-loop.ts). The data has been accumulating in weekly
 * buckets since the loop shipped — this route is the first surface that
 * actually reads it back out for a human.
 */
export const GET = withErrorHandler(
  "admin-denis-weekly-quality-get",
  async (req, _ctx) => {
    const limited = await withStaffRateLimit(req);
    if (limited) return limited;

    await requireAdmin();

    const report = await buildWeeklyQualityReport();
    return NextResponse.json({ data: report });
  }
);
