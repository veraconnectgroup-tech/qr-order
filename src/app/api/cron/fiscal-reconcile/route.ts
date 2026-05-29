export const maxDuration = 60;

import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { reconcileFiscalJournal } from "@/lib/fiscal/runtime/fiscal-reconcile";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

export const GET = withErrorHandler(
  "cron-fiscal-reconcile-get",
  async (req, _ctx) => {
    const secret = process.env.CRON_SECRET;
    const auth = req.headers.get("authorization");

    if (!secret || auth !== `Bearer ${secret}`) {
      return apiError("Unauthorized", 401);
    }

    try {
      const admin = createAdminClient();
      const result = await reconcileFiscalJournal(admin, { lookbackHours: 48 });

      return apiSuccess({
        checked: result.checked,
        mismatchCount: result.mismatches.length,
        skipped: result.skipped,
        mismatches: result.mismatches.map((row) => ({
          fiscalTransactionId: row.fiscalTransactionId,
          orderId: row.orderId,
          issue: row.issue,
        })),
      });
    } catch (error) {
      logger.error("Fiscal reconcile cron failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return apiError(
        error instanceof Error ? error.message : "Fiscal reconcile failed.",
        500
      );
    }
  }
);
