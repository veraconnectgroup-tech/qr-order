import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { withRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  sessionToken: z.string().min(1),
  guestEmail: z.string().email(),
});

export async function POST(req: NextRequest) {
  try {
    const limited = await withRateLimit(req, "sessions");
    if (limited) return limited;

    const body = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return apiError("Invalid input", 400);
    }

    const admin = createAdminClient();
    const { sessionToken, guestEmail } = parsed.data;

    const { data: session } = await admin
      .from("table_sessions")
      .select("id, status")
      .eq("session_token", sessionToken)
      .eq("status", "active")
      .maybeSingle();

    if (!session) {
      return apiError("Session not found.", 404);
    }

    const { error } = await admin
      .from("table_sessions")
      .update({ guest_email: guestEmail })
      .eq("id", (session as { id: string }).id);

    if (error) {
      return apiError("Could not save email.", 500);
    }

    return apiSuccess({ ok: true });
  } catch (error) {
    logger.error("Guest email save error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError("Internal error.", 500);
  }
}
