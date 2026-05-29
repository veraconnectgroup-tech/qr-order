import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { auditLog } from "@/lib/audit/log";
import { loadComplianceContextForLocation } from "@/lib/auth/compliance-guards";
import { requireStaffPermission } from "@/lib/auth/require-staff-permission";
import { runManualDailyClosing } from "@/lib/fiscal/daily-closing";
import { logger } from "@/lib/logger";
import { withRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  locationId: z.string().uuid(),
  businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const POST = withErrorHandler(
  "fiscal-daily-closing-post",
  async (req, _ctx) => {
    const limited = await withRateLimit(req, "fiscal");
    if (limited) return limited;

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return apiError("Invalid input.", 400);
    }

    const complianceCtx = await loadComplianceContextForLocation(
      parsed.data.locationId
    );
    const staff = await requireStaffPermission(
      "fiscal.shift.close",
      complianceCtx
    );

    const admin = createAdminClient();
    const { data: location, error: locationError } = await admin
      .from("locations")
      .select("id, org_id, timezone")
      .eq("id", parsed.data.locationId)
      .eq("org_id", staff.org_id)
      .single();

    if (locationError || !location) {
      return apiError("Location not found.", 404);
    }

    const locationRow = location as {
      id: string;
      org_id: string;
      timezone: string;
    };

    try {
      const result = await runManualDailyClosing(admin, {
        orgId: locationRow.org_id,
        locationId: locationRow.id,
        businessDate: parsed.data.businessDate,
        timezone: locationRow.timezone || "Europe/Berlin",
        closedBy: staff.user_id,
      });

      await auditLog({
        orgId: locationRow.org_id,
        userId: staff.user_id,
        action: "fiscal",
        entityType: "daily_closing",
        entityId: result.id,
        newValue: {
          businessDate: result.data.businessDate,
          orderCount: result.data.orderCount,
          totalGross: result.data.totalGross,
        },
        request: req,
      });

      return apiSuccess({
        id: result.id,
        businessDate: result.data.businessDate,
        orderCount: result.data.orderCount,
        totalGross: result.data.totalGross,
      });
    } catch (error) {
      logger.error("Manual daily closing failed", {
        locationId: parsed.data.locationId,
        businessDate: parsed.data.businessDate,
        error: error instanceof Error ? error.message : String(error),
      });
      return apiError(
        error instanceof Error ? error.message : "Daily closing failed.",
        500
      );
    }
  }
);
