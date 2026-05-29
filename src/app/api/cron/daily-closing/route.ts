import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import {
  computeDailyClosing,
  dailyClosingExists,
  listStandaloneLocations,
  yesterdayBusinessDate,
} from "@/lib/fiscal/daily-closing";
import { runFiscalZClosingPipeline } from "@/lib/fiscal/runtime/run-fiscal-z-closing";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

export const GET = withErrorHandler(
  "cron-daily-closing-get",
  async (req, _ctx) => {
    const secret = process.env.CRON_SECRET;
    const auth = req.headers.get("authorization");

    if (!secret || auth !== `Bearer ${secret}`) {
      return apiError("Unauthorized", 401);
    }

    const admin = createAdminClient();
    const locations = await listStandaloneLocations(admin);

    let processed = 0;
    let skipped = 0;
    let failed = 0;
    const errors: Array<{ locationId: string; error: string }> = [];

    for (const location of locations) {
      const businessDate = yesterdayBusinessDate(location.timezone);

      try {
        const exists = await dailyClosingExists(
          admin,
          location.id,
          businessDate
        );
        if (exists) {
          skipped += 1;
          continue;
        }

        const data = await computeDailyClosing(
          admin,
          location.org_id,
          location.id,
          businessDate,
          location.timezone
        );

        const result = await runFiscalZClosingPipeline(admin, data);

        processed += 1;
        logger.info("Daily closing completed", {
          locationId: location.id,
          orgId: location.org_id,
          businessDate,
          closingId: result.id,
          fiscalTransactionId: result.fiscalTransactionId,
          zNr: result.zNr,
          orderCount: data.orderCount,
        });
      } catch (err) {
        failed += 1;
        const message = err instanceof Error ? err.message : String(err);
        errors.push({ locationId: location.id, error: message });
        logger.error("Daily closing failed for location", {
          locationId: location.id,
          orgId: location.org_id,
          businessDate,
          error: message,
        });
      }
    }

    return apiSuccess({
      locations: locations.length,
      processed,
      skipped,
      failed,
      errors,
    });
  }
);
