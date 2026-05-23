import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { withRateLimitScope } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  sessionToken: z.string().min(1),
  guestEmail: z.string().email(),
});

export async function POST(req: NextRequest) {
  try {
    const limited = await withRateLimitScope(req, "sessions");
    if (limited) return limited;

    const body = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
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
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    const { error } = await admin
      .from("table_sessions")
      .update({ guest_email: guestEmail })
      .eq("id", (session as { id: string }).id);

    if (error) {
      return NextResponse.json({ error: "Could not save email." }, { status: 500 });
    }

    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    logger.error("Guest email save error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Internal error." }, { status: 500 });
  }
}
