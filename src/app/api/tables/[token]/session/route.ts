import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import {
  getDemoGuestSession,
  isDemoGuestTableToken,
} from "@/lib/demo-guest";
import { withRateLimit } from "@/lib/rate-limit";
import { zTableToken } from "@/lib/security/zod-fields";
import { findOrCreateTableSession } from "@/lib/sessions/find-or-create-table-session";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  tableToken: zTableToken(),
});

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
      return apiSuccess(getDemoGuestSession());
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

    const sessionResult = await findOrCreateTableSession(
      admin,
      tableRow.id,
      tableRow.location_id
    );

    if ("error" in sessionResult) {
      return apiError(sessionResult.error, sessionResult.status);
    }

    return apiSuccess({
      sessionId: sessionResult.sessionId,
      sessionToken: sessionResult.sessionToken,
      tableId: tableRow.id,
      tableName: tableRow.name,
      locationId: tableRow.location_id,
    });
  }
);
