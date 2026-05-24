import { auditLog } from "@/lib/audit/log";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { withStaffRateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/security/sanitize";
import { findOrCreateTableSession } from "@/lib/sessions/find-or-create-table-session";
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
  "session-reopen",
  async (req, ctx) => {
    const limited = await withStaffRateLimit(req);
    if (limited) return limited;

    const staff = await loadStaff();
    if (!staff || !["owner", "manager"].includes(staff.role)) {
      return apiError("Unauthorized.", 401);
    }

    const { sessionId } = await ctx.params;
    if (!isUuid(sessionId)) {
      return apiError("Invalid session id.", 400);
    }

    const admin = createAdminClient();

    const { data: original } = await admin
      .from("table_sessions")
      .select("id, table_id, location_id, status")
      .eq("id", sessionId)
      .maybeSingle();

    if (!original) {
      return apiError("Session not found.", 404);
    }

    const session = original as {
      id: string;
      table_id: string;
      location_id: string;
      status: string;
    };

    if (session.status !== "closed") {
      return apiError("Session is still active.", 409);
    }

    const { data: location } = await admin
      .from("locations")
      .select("org_id")
      .eq("id", session.location_id)
      .maybeSingle();

    if (!location || (location as { org_id: string }).org_id !== staff.org_id) {
      return apiError("Unauthorized.", 403);
    }

    if (staff.location_id && staff.location_id !== session.location_id) {
      return apiError("Unauthorized.", 403);
    }

    const result = await findOrCreateTableSession(
      admin,
      session.table_id,
      session.location_id
    );

    if ("error" in result) {
      return apiError(result.error, result.status);
    }

    await auditLog({
      orgId: staff.org_id,
      userId: staff.user_id,
      action: "create",
      entityType: "table_session",
      entityId: result.sessionId,
      newValue: {
        reopened_from: sessionId,
        table_id: session.table_id,
        location_id: session.location_id,
      },
      request: req,
    });

    return apiSuccess({
      new_session_id: result.sessionId,
      table_id: session.table_id,
    });
  }
);
