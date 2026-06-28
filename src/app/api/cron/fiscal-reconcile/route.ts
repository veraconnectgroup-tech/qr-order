export const maxDuration = 60;

import { apiError, apiSuccess } from "@/lib/api-response";
import { withCronRateLimit } from "@/lib/api-guard";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { reconcileFiscalJournal } from "@/lib/fiscal/runtime/fiscal-reconcile";
import { replayPendingFiscalTransactions } from "@/lib/fiscal/runtime/replay-pending-fiscal-transactions";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

export const GET = withErrorHandler(
  "cron-fiscal-reconcile-get",
  async (req, _ctx) => {
  const limited = await withCronRateLimit(req);
  if (limited) return limited;

    const secret = process.env.CRON_SECRET;
    const auth = req.headers.get("authorization");

    if (!secret || auth !== `Bearer ${secret}`) {
      return apiError("Unauthorized", 401);
    }

    try {
      const admin = createAdminClient();
      const replay = await replayPendingFiscalTransactions(admin, {
        limit: 50,
        lookbackHours: 72,
      });
      const result = await reconcileFiscalJournal(admin, { lookbackHours: 48 });

      return apiSuccess({
        replay,
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
