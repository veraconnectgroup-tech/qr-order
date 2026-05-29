export const maxDuration = 15;

import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { auditLog } from "@/lib/audit/log";
import { requireStaffPermission } from "@/lib/auth/require-staff-permission";
import { provisionFiskalyRegisterForLocation } from "@/lib/fiscal/provision-fiskaly-register";
import { provisionFiskalyTss } from "@/lib/fiscal/provision-tss";
import { isFiskalyConfigured } from "@/lib/fiscal/fiskaly";
import { logger } from "@/lib/logger";
import { withRateLimit } from "@/lib/rate-limit";

export const POST = withErrorHandler(
  "fiscal-provision-post",
  async (req, _ctx) => {
    try {
      const limited = await withRateLimit(req, "fiscal");
      if (limited) return limited;

      const staff = await requireStaffPermission("fiscal.register.manage");

      if (!isFiskalyConfigured()) {
        return apiError(
          "Fiskaly platform credentials are not configured (FISKALY_API_KEY / FISKALY_API_SECRET).",
          503
        );
      }

      let body: { locationId?: string } = {};
      try {
        body = (await req.json()) as { locationId?: string };
      } catch {
        body = {};
      }

      if (body.locationId) {
        const registerResult = await provisionFiskalyRegisterForLocation(
          staff.org_id,
          body.locationId
        );

        if (!registerResult) {
          return apiError("Fiskaly is not configured on this platform.", 503);
        }

        await auditLog({
          orgId: staff.org_id,
          userId: staff.user_id,
          action: "fiscal",
          entityType: "fiscal_register_provision",
          entityId: registerResult.registerId,
          newValue: {
            locationId: body.locationId,
            registerId: registerResult.registerId,
            tssId: registerResult.tssId,
            clientId: registerResult.clientId,
            kassenId: registerResult.kassenId,
            skipped: registerResult.skipped,
          },
          request: req,
        });

        return apiSuccess({
          registerId: registerResult.registerId,
          tssId: registerResult.tssId,
          clientId: registerResult.clientId,
          kassenId: registerResult.kassenId,
          skipped: registerResult.skipped,
        });
      }

      const result = await provisionFiskalyTss(staff.org_id);

      if (!result) {
        return apiError("Fiskaly is not configured on this platform.", 503);
      }

      await auditLog({
        orgId: staff.org_id,
        userId: staff.user_id,
        action: "fiscal",
        entityType: "fiscal_tss_provision",
        newValue: {
          tssId: result.tssId,
          clientId: result.clientId,
          skipped: result.skipped,
        },
        request: req,
      });

      return apiSuccess({
        tssId: result.tssId,
        clientId: result.clientId,
        skipped: result.skipped,
      });
    } catch (error) {
      logger.error("Manual TSE provisioning failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return apiError(
        error instanceof Error ? error.message : "TSE provisioning failed.",
        500
      );
    }
  }
);
