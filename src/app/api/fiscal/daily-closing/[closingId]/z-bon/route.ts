import { apiError } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { requireStaffAnyPermission } from "@/lib/auth/require-staff-permission";
import {
  buildZBonHtml,
  loadZBonDisplayData,
} from "@/lib/fiscal/daily-closing";
import { withStaffRateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/security/sanitize";
import { createAdminClient } from "@/lib/supabase/admin";

export const GET = withErrorHandler(
  "fiscal-daily-closing-zbon-get",
  async (req, ctx) => {
    const limited = await withStaffRateLimit(req);
  if (limited) return limited;

    const staff = await requireStaffAnyPermission([
      "fiscal.shift.read",
      "fiscal.shift.close",
    ]);

    const { closingId } = await ctx.params;
    if (!isUuid(closingId)) {
      return apiError("Invalid closing id.", 400);
    }

    const admin = createAdminClient();
    const display = await loadZBonDisplayData(admin, closingId, staff.org_id);

    if (!display) {
      return apiError("Closing not found.", 404);
    }

    const html = await buildZBonHtml(display);

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }
);
