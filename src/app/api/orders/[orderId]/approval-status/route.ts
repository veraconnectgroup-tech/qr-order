import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { noCache } from "@/lib/cache/headers";
import { consumePinReveal } from "@/lib/sessions/pin-reveal-cache";
import { getActiveDeviceBlock } from "@/lib/sessions/order-blocks";
import { trustSessionDevice } from "@/lib/sessions/session-devices";
import { withRateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/security/sanitize";
import { zTableToken } from "@/lib/security/zod-fields";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

export const GET = withErrorHandler(
  "orders-orderId-approval-status-get",
  async (req, ctx) => {
    const cacheHeaders = noCache();
    const limited = await withRateLimit(req, "orders-guest");
    if (limited) return limited;

    const { orderId } = await ctx.params;
    if (!isUuid(orderId)) {
      return apiError("Invalid order id.", 400, undefined, cacheHeaders);
    }

    const tableTokenParsed = zTableToken().safeParse(
      req.nextUrl.searchParams.get("tableToken")
    );
    const deviceFingerprint =
      req.nextUrl.searchParams.get("deviceFingerprint") ?? "";

    if (!tableTokenParsed.success || deviceFingerprint.length < 8) {
      return apiError("Invalid request.", 400, undefined, cacheHeaders);
    }

    const admin = createAdminClient();

    const { data: order } = await admin
      .from("orders")
      .select(
        "id, status, table_id, device_fingerprint, rejection_reason, session_id"
      )
      .eq("id", orderId)
      .single();

    if (!order) {
      return apiError("Not found.", 404, undefined, cacheHeaders);
    }

    const orderRow = order as {
      id: string;
      status: string;
      table_id: string | null;
      device_fingerprint: string | null;
      rejection_reason: string | null;
      session_id: string | null;
    };

    if (orderRow.device_fingerprint !== deviceFingerprint) {
      return apiError("Unauthorized.", 401, undefined, cacheHeaders);
    }

    const { data: table } = await admin
      .from("tables")
      .select("id, qr_token")
      .eq("id", orderRow.table_id ?? "")
      .single();

    if (
      !table ||
      (table as { qr_token: string }).qr_token !== tableTokenParsed.data
    ) {
      return apiError("Unauthorized.", 401, undefined, cacheHeaders);
    }

    if (orderRow.status === "pending_approval") {
      return apiSuccess(
        { status: "pending_approval" as const },
        200,
        cacheHeaders
      );
    }

    if (orderRow.status === "rejected") {
      let deviceBlocked = false;
      let deviceBlockedUntil: string | null = null;

      if (orderRow.table_id) {
        const block = await getActiveDeviceBlock(
          admin,
          orderRow.table_id,
          deviceFingerprint
        );
        if (block) {
          deviceBlocked = true;
          deviceBlockedUntil = block.blocked_until;
        }
      }

      return apiSuccess(
        {
          status: "rejected" as const,
          rejectionReason: orderRow.rejection_reason,
          deviceBlocked,
          deviceBlockedUntil,
        },
        200,
        cacheHeaders
      );
    }

    if (!orderRow.session_id) {
      return apiSuccess({ status: "pending" as const }, 200, cacheHeaders);
    }

    const { data: session } = await admin
      .from("table_sessions")
      .select("id, session_token")
      .eq("id", orderRow.session_id)
      .single();

    if (!session) {
      return apiSuccess({ status: "pending" as const }, 200, cacheHeaders);
    }

    const sessionRow = session as { id: string; session_token: string };

    let deviceToken: string | undefined;
    try {
      const trustResult = await trustSessionDevice(admin, {
        sessionId: sessionRow.id,
        deviceFingerprint,
        userAgent: req.headers.get("user-agent"),
      });
      deviceToken = trustResult.deviceToken;
    } catch (error) {
      logger.warn("Device trust failed during approval status poll", {
        orderId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const tablePin = await consumePinReveal(orderId);

    return apiSuccess(
      {
        status: "approved" as const,
        sessionToken: sessionRow.session_token,
        sessionId: sessionRow.id,
        deviceToken,
        tablePin,
      },
      200,
      cacheHeaders
    );
  }
);
