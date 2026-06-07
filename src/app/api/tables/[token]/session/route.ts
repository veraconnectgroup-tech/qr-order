import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import {
  getDemoGuestSession,
  isDemoGuestTableToken,
} from "@/lib/demo-guest";
import { getActiveTableSession } from "@/lib/sessions/session-devices";
import { withRateLimit } from "@/lib/rate-limit";
import { zTableToken } from "@/lib/security/zod-fields";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  tableToken: zTableToken(),
});

/** Returns existing active session only — never auto-creates. */
export const POST = withErrorHandler(
  "tables-token-session-post",
  async (req, ctx) => {
    const limited = await withRateLimit(req, "sessions");
    if (limited) return limited;

    const { token } = await ctx.params;
    const tokenParsed = zTableToken().safeParse(token);
    if (!tokenParsed.success) {
      return apiError("Invalid request.", 400);
    }

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse({ tableToken: tokenParsed.data, ...body });

    if (!parsed.success) {
      return apiError("Invalid request.", 400);
    }

    if (isDemoGuestTableToken(tokenParsed.data)) {
      const demo = getDemoGuestSession();
      return apiSuccess({
        sessionStatus: "active" as const,
        sessionId: demo.sessionId,
        sessionToken: demo.sessionToken,
        tableId: demo.tableId,
        tableName: demo.tableName,
        locationId: demo.locationId,
      });
    }

    const admin = createAdminClient();

    const { data: table } = await admin
      .from("tables")
      .select("id, name, location_id")
      .eq("qr_token", tokenParsed.data)
      .eq("is_active", true)
      .is("deleted_at", null)
      .single();

    if (!table) {
      return apiError("Table not found.", 404);
    }

    const tableRow = table as {
      id: string;
      name: string;
      location_id: string;
    };

    const session = await getActiveTableSession(admin, tableRow.id);

    if (!session) {
      return apiSuccess({
        sessionStatus: "none" as const,
        tableId: tableRow.id,
        tableName: tableRow.name,
        locationId: tableRow.location_id,
      });
    }

    return apiSuccess({
      sessionStatus: "active" as const,
      sessionId: session.id,
      sessionToken: session.session_token,
      tableId: tableRow.id,
      tableName: tableRow.name,
      locationId: tableRow.location_id,
    });
  }
);
