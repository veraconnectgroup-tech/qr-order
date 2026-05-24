import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { withRateLimit } from "@/lib/rate-limit";
import { closeTableSession } from "@/lib/sessions/session-devices";
import { isUuid } from "@/lib/security/sanitize";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";
import type { Staff } from "@/types";

async function loadStaff(): Promise<Staff | null> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: staff } = await supabase
    .from("staff")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();

  return (staff as Staff | null) ?? null;
}

export const POST = withErrorHandler(
  "sessions-sessionId-close-post",
  async (req, ctx) => {
    const limited = await withRateLimit(req, "orders");
    if (limited) return limited;

    const staff = await loadStaff();
    if (!staff || !["owner", "manager", "staff"].includes(staff.role)) {
      return apiError("Unauthorized.", 401);
    }

    const { sessionId } = await ctx.params;
    if (!isUuid(sessionId)) {
      return apiError("Invalid session id.", 400);
    }

    const admin = createAdminClient();

    const { data: session } = await admin
      .from("table_sessions")
      .select("id, location_id, status")
      .eq("id", sessionId)
      .maybeSingle();

    if (!session) {
      return apiError("Session not found.", 404);
    }

    const row = session as {
      id: string;
      location_id: string;
      status: string;
    };

    if (row.status !== "active") {
      return apiError("Session is already closed.", 409);
    }

    const { data: location } = await admin
      .from("locations")
      .select("org_id")
      .eq("id", row.location_id)
      .single();

    if (!location || (location as { org_id: string }).org_id !== staff.org_id) {
      return apiError("Unauthorized.", 403);
    }

    await closeTableSession(admin, sessionId);

    return apiSuccess({ closed: true });
  }
);
