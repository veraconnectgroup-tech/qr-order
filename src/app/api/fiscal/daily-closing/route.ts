import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { getCurrentStaff } from "@/lib/auth/session";
import { runManualDailyClosing } from "@/lib/fiscal/daily-closing";
import { logger } from "@/lib/logger";
import { withRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  locationId: z.string().uuid(),
  businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

async function requireFiscalAdmin() {
  const staff = await getCurrentStaff();
  if (!staff || !["owner", "manager"].includes(staff.role)) {
    return null;
  }
  return staff;
}

export const POST = withErrorHandler(
  "fiscal-daily-closing-post",
  async (req, _ctx) => {
    const limited = await withRateLimit(req, "fiscal");
    if (limited) return limited;

    const staff = await requireFiscalAdmin();
    if (!staff) {
      return apiError("Unauthorized.", 401);
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return apiError("Invalid input.", 400);
    }

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
