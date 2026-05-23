import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { validateTableSession } from "@/lib/orders/validate-table-session";
import { checkRateLimit, getClientIp, withRateLimit } from "@/lib/rate-limit";
import { zOptionalSanitizedText, zSessionToken, zTableToken } from "@/lib/security/zod-fields";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  tableToken: zTableToken(),
  sessionToken: zSessionToken(),
  message: zOptionalSanitizedText(200),
});

export async function POST(req: NextRequest) {
  try {
    const limited = await withRateLimit(req, "default");
    if (limited) return limited;

    const body = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return apiError("Invalid input", 400, parsed.error.flatten());
    }

    const admin = createAdminClient();
    const ip = getClientIp(req);
    const tableKey = `waiter:table:${parsed.data.tableToken}`;
    const ipKey = `waiter:ip:${ip}`;

    if (!checkRateLimit(tableKey, 100, 60 * 60 * 1000)) {
      return apiError("Too many waiter calls from this table", 429);
    }

    if (!checkRateLimit(ipKey, 50, 60 * 60 * 1000)) {
      return apiError("Too many waiter calls", 429);
    }

    const sessionResult = await validateTableSession(
      admin,
      parsed.data.tableToken,
      parsed.data.sessionToken
    );

    if ("error" in sessionResult) {
      return apiError(sessionResult.error, sessionResult.status);
    }

    const { table: tableRow, session: sessionRow } = sessionResult.data;

    const { error } = await admin.from("waiter_calls").insert({
      table_id: tableRow.id,
      location_id: tableRow.location_id,
      session_id: sessionRow.id,
    });

    if (error) {
      return apiError("Waiter call could not be created.", 500);
    }

    return apiSuccess({ ok: true });
  } catch (error) {
    logger.error("Waiter call error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError("Internal error.", 500);
  }
}
