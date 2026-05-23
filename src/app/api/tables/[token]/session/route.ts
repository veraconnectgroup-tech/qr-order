import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { SESSION_MAX_AGE_HOURS } from "@/lib/constants";
import { logger } from "@/lib/logger";
import { withRateLimit } from "@/lib/rate-limit";
import { zTableToken } from "@/lib/security/zod-fields";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  tableToken: zTableToken(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const limited = await withRateLimit(req, "sessions");
    if (limited) return limited;

    const { token } = await params;
    const tokenParsed = zTableToken().safeParse(token);
    if (!tokenParsed.success) {
      return apiError("Invalid request.", 400);
    }

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse({ tableToken: tokenParsed.data, ...body });

    if (!parsed.success) {
      return apiError("Invalid request.", 400);
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

    const maxAge = SESSION_MAX_AGE_HOURS * 60 * 60 * 1000;
    const cutoff = new Date(Date.now() - maxAge).toISOString();

    const { data: existing } = await admin
      .from("table_sessions")
      .select("*")
      .eq("table_id", tableRow.id)
      .eq("status", "active")
      .gte("opened_at", cutoff)
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      const row = existing as { id: string; session_token: string };
      return apiSuccess({
        sessionId: row.id,
        sessionToken: row.session_token,
        tableId: tableRow.id,
        tableName: tableRow.name,
        locationId: tableRow.location_id,
      });
    }

    await admin
      .from("table_sessions")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("table_id", tableRow.id)
      .eq("status", "active");

    const { data: session, error } = await admin
      .from("table_sessions")
      .insert({
        table_id: tableRow.id,
        location_id: tableRow.location_id,
      })
      .select("id, session_token")
      .single();

    if (error || !session) {
      return apiError("Session could not be created.", 500);
    }

    const sessionRow = session as { id: string; session_token: string };

    return apiSuccess({
      sessionId: sessionRow.id,
      sessionToken: sessionRow.session_token,
      tableId: tableRow.id,
      tableName: tableRow.name,
      locationId: tableRow.location_id,
    });
  } catch (error) {
    logger.error("Session API error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError("Internal server error.", 500);
  }
}
