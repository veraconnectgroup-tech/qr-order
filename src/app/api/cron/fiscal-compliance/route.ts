export const maxDuration = 60;

import { apiError, apiSuccess } from "@/lib/api-response";
import { withCronRateLimit } from "@/lib/api-guard";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import {
  dispatchFiscalComplianceAlerts,
  verifyFiscalComplianceForLocation,
  type FiscalComplianceRunResult,
} from "@/lib/fiscal/compliance-check";
import { listStandaloneLocations, yesterdayBusinessDate } from "@/lib/fiscal/daily-closing";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

export const GET = withErrorHandler(
  "cron-fiscal-compliance-get",
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
      const locations = await listStandaloneLocations(admin);

      const locationResults = [];
      for (const location of locations) {
        const businessDate = yesterdayBusinessDate(location.timezone);
        const result = await verifyFiscalComplianceForLocation(
          admin,
          location.org_id,
          location.id,
          businessDate,
          location.timezone
        );
        locationResults.push(result);
      }

      const merged: FiscalComplianceRunResult = {
        locations: locationResults,
        criticalCount: locationResults.reduce(
          (sum, r) =>
            sum + r.issues.filter((i) => i.severity === "critical").length,
          0
        ),
        warningCount: locationResults.reduce(
          (sum, r) =>
            sum + r.issues.filter((i) => i.severity === "warning").length,
          0
        ),
      };

      const { alertsSent } = await dispatchFiscalComplianceAlerts(admin, merged);

      logger.info("Fiscal compliance cron completed", {
        locationsChecked: merged.locations.length,
        criticalCount: merged.criticalCount,
        warningCount: merged.warningCount,
        alertsSent,
      });

      return apiSuccess({
        locationsChecked: merged.locations.length,
        criticalCount: merged.criticalCount,
        warningCount: merged.warningCount,
        alertsSent,
      });
    } catch (error) {
      logger.error("Fiscal compliance cron failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return apiError(
        error instanceof Error ? error.message : "Fiscal compliance failed.",
        500
      );
    }
  }
);
