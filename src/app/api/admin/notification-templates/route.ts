import { apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { NOTIFICATION_TEMPLATES } from "@/lib/notifications/templates";
import { getCurrentStaff, getStaffLocationId } from "@/lib/auth/session";
import { withStaffRateLimit } from "@/lib/rate-limit";

/** Staff: list notification template catalog (Prompt 89). */
export const GET = withErrorHandler(
  "admin-notification-templates-get",
  async (req) => {
    const limited = await withStaffRateLimit(req);
    if (limited) return limited;

    const staff = await getCurrentStaff();
    if (!staff) {
      return apiSuccess({ templates: [] });
    }

    const locationId = await getStaffLocationId(staff);
    return apiSuccess({
      locationId,
      templates: NOTIFICATION_TEMPLATES,
    });
  }
);
