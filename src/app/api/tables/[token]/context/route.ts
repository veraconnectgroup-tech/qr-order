import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import {
  getDemoGuestSession,
  isDemoGuestTableToken,
} from "@/lib/demo-guest";
import { resolveTableGuestContext } from "@/lib/sessions/resolve-table-context";
import { withRateLimit } from "@/lib/rate-limit";
import { zTableToken } from "@/lib/security/zod-fields";
import { createAdminClient } from "@/lib/supabase/admin";

export const GET = withErrorHandler(
  "tables-token-context-get",
  async (req, ctx) => {
    const limited = await withRateLimit(req, "sessions");
    if (limited) return limited;

    const { token } = await ctx.params;
    const tokenParsed = zTableToken().safeParse(token);
    if (!tokenParsed.success) {
      return apiError("Invalid request.", 400);
    }

    if (isDemoGuestTableToken(tokenParsed.data)) {
      const demo = getDemoGuestSession();
      return apiSuccess({
        tableId: demo.tableId,
        tableName: demo.tableName,
        locationId: demo.locationId,
        sessionStatus: "active",
        sessionToken: demo.sessionToken,
        sessionId: demo.sessionId,
        billStatus: "open",
        hasPin: false,
        pendingApprovalOrderId: null,
        capabilities: {
          canBrowseMenu: true,
          canViewBill: true,
          canViewOrderStatus: true,
          canPlaceOrders: true,
          needsPin: false,
          awaitingApproval: false,
          deviceBlocked: false,
          deviceBlockedUntil: null,
        },
      });
    }

    const deviceFingerprint =
      req.nextUrl.searchParams.get("deviceFingerprint") ?? undefined;
    const deviceToken =
      req.nextUrl.searchParams.get("deviceToken") ?? undefined;

    const admin = createAdminClient();
    const result = await resolveTableGuestContext(
      admin,
      tokenParsed.data,
      { deviceFingerprint, deviceToken }
    );

    if ("error" in result) {
      return apiError(result.error, result.status);
    }

    return apiSuccess(result.data);
  }
);
