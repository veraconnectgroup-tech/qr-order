import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import {
  getDemoGuestSession,
  isDemoGuestTableToken,
} from "@/lib/demo-guest";
import {
  trustSessionDevice,
} from "@/lib/sessions/session-devices";
import { verifyTablePin } from "@/lib/sessions/table-pin";
import { withRateLimit } from "@/lib/rate-limit";
import { zTableToken } from "@/lib/security/zod-fields";
import { createAdminClient } from "@/lib/supabase/admin";

const pinSchema = z.object({
  tableToken: zTableToken(),
  tablePin: z.string().regex(/^\d{4}$/),
  deviceFingerprint: z.string().min(8).max(128),
});

export const POST = withErrorHandler(
  "tables-token-pin-post",
  async (req, ctx) => {
    const limited = await withRateLimit(req, "pin-verify");
    if (limited) return limited;

    const { token } = await ctx.params;
    const tokenParsed = zTableToken().safeParse(token);
    if (!tokenParsed.success) {
      return apiError("Invalid request.", 400);
    }

    if (isDemoGuestTableToken(tokenParsed.data)) {
      const demo = getDemoGuestSession();
      return apiSuccess({
        sessionToken: demo.sessionToken,
        sessionId: demo.sessionId,
        deviceToken: "demo-device",
      });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = pinSchema.safeParse({
      tableToken: tokenParsed.data,
      ...body,
    });

    if (!parsed.success) {
      return apiError("Invalid request.", 400);
    }

    const admin = createAdminClient();
    const { data: table } = await admin
      .from("tables")
      .select("id")
      .eq("qr_token", parsed.data.tableToken)
      .eq("is_active", true)
      .is("deleted_at", null)
      .single();

    if (!table) {
      return apiError("Table not found.", 404);
    }

    const tableRow = table as { id: string };

    const { data: session } = await admin
      .from("table_sessions")
      .select("id, session_token, order_pin_hash")
      .eq("table_id", tableRow.id)
      .eq("status", "active")
      .eq("bill_status", "open")
      .maybeSingle();

    if (!session) {
      return apiError("No active session for this table.", 404);
    }

    const sessionRow = session as {
      id: string;
      session_token: string;
      order_pin_hash: string | null;
    };

    if (!sessionRow.order_pin_hash) {
      return apiError("PIN not configured.", 400);
    }

    if (!verifyTablePin(parsed.data.tablePin, sessionRow.order_pin_hash)) {
      return apiError("Invalid PIN.", 403);
    }

    const { deviceToken } = await trustSessionDevice(admin, {
      sessionId: sessionRow.id,
      deviceFingerprint: parsed.data.deviceFingerprint,
      userAgent: req.headers.get("user-agent"),
    });

    return apiSuccess({
      sessionToken: sessionRow.session_token,
      sessionId: sessionRow.id,
      deviceToken,
    });
  }
);
