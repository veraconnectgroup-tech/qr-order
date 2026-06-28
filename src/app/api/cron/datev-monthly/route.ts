export const maxDuration = 120;

import { apiError, apiSuccess } from "@/lib/api-response";
import { withCronRateLimit } from "@/lib/api-guard";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { auditLog } from "@/lib/audit/log";
import { generatePreviousMonthDatevExport } from "@/lib/export/datev";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

export const GET = withErrorHandler(
  "cron-datev-monthly-get",
  async (req, _ctx) => {
    const limited = await withCronRateLimit(req);
    if (limited) return limited;

    const secret = process.env.CRON_SECRET;
    const auth = req.headers.get("authorization");

    if (!secret || auth !== `Bearer ${secret}`) {
      return apiError("Unauthorized", 401);
    }

    const admin = createAdminClient();
    const { data: orgs, error } = await admin
      .from("organizations")
      .select("id, name");

    if (error) {
      return apiError(`Organizations load failed: ${error.message}`, 500);
    }

    let processed = 0;
    let failed = 0;
    const exports: Array<{ orgId: string; filename: string; rowBytes: number }> =
      [];

    for (const org of orgs ?? []) {
      const orgRow = org as { id: string; name: string };
      try {
        const result = await generatePreviousMonthDatevExport(orgRow.id);
        processed += 1;
        exports.push({
          orgId: orgRow.id,
          filename: result.filename,
          rowBytes: result.csv.length,
        });

        await auditLog({
          orgId: orgRow.id,
          action: "fiscal",
          entityType: "datev_export",
          entityId: result.label,
          newValue: {
            filename: result.filename,
            period: result.label,
            bytes: result.csv.length,
            source: "cron.datev-monthly",
          },
        });
      } catch (err) {
        failed += 1;
        logger.error("Monthly DATEV export failed", {
          orgId: orgRow.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logger.info("Monthly DATEV cron completed", {
      orgCount: (orgs ?? []).length,
      processed,
      failed,
    });

    return apiSuccess({
      orgCount: (orgs ?? []).length,
      processed,
      failed,
      exports,
    });
  }
);
