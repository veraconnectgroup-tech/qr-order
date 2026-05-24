import { apiError } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { getCurrentStaff } from "@/lib/auth/session";
import {
  buildZBonHtml,
  loadZBonDisplayData,
} from "@/lib/fiscal/daily-closing";
import { isUuid } from "@/lib/security/sanitize";
import { createAdminClient } from "@/lib/supabase/admin";

export const GET = withErrorHandler(
  "fiscal-daily-closing-zbon-get",
  async (_req, ctx) => {
    const staff = await getCurrentStaff();
    if (!staff || !["owner", "manager", "staff", "kitchen"].includes(staff.role)) {
      return apiError("Unauthorized.", 401);
    }

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
