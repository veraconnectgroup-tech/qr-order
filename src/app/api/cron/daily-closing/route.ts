import { apiError, apiSuccess } from "@/lib/api-response";
import { withCronRateLimit } from "@/lib/api-guard";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import {
  computeDailyClosing,
  dailyClosingExists,
  listStandaloneLocations,
  yesterdayBusinessDate,
} from "@/lib/fiscal/daily-closing";
import { runFiscalZClosingPipeline } from "@/lib/fiscal/runtime/run-fiscal-z-closing";
import { runDenisDayClose } from "@/lib/denis/memory/day-close";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

export const GET = withErrorHandler(
  "cron-daily-closing-get",
  async (req, _ctx) => {
  const limited = await withCronRateLimit(req);
  if (limited) return limited;

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

        // ADR-045 S2: Day Close runs after the fiscal daily closing so
        // shift recap/rollup has already read today's shift state.
        try {
          await runDenisDayClose(admin, {
            locationId: location.id,
            businessDate,
          });
        } catch (dayCloseError) {
          logger.error("Denis day close failed for location", {
            locationId: location.id,
            orgId: location.org_id,
            businessDate,
            error:
              dayCloseError instanceof Error
                ? dayCloseError.message
                : String(dayCloseError),
          });
        }
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
