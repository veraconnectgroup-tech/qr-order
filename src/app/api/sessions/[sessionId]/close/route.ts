import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { withStaffRateLimit } from "@/lib/rate-limit";
import { closeTableSession } from "@/lib/sessions/session-devices";
import { isUuid } from "@/lib/security/sanitize";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";
import { zOrderNotesOptional } from "@/lib/security/zod-fields";
import { recordSensitiveAction } from "@/lib/audit/record-sensitive-action";
import { evaluateSessionCloseBalance } from "@/lib/loss-prevention/payment-guardrails";
import { loadSessionPaymentSnapshot } from "@/lib/loss-prevention/session-payment-snapshot";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import { z } from "zod";
import type { Staff } from "@/types";

const closeSchema = z.object({
  closeReason: zOrderNotesOptional(),
});

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
    const limited = await withStaffRateLimit(req);
    if (limited) return limited;

    const staff = await loadStaff();
    if (!staff || !["owner", "manager", "staff", "waiter"].includes(staff.role)) {
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

    let closeReason: string | null = null;
    try {
      const body = await req.json();
      const parsed = closeSchema.safeParse(body);
      if (parsed.success) {
        closeReason = parsed.data.closeReason ?? null;
      }
    } catch {
      // Body optional — manual close without JSON is allowed when balance is zero.
    }

    const config = await loadConciergeConfigForLocation(row.location_id);
    const paymentGuardrailsEnabled =
      config.ops.lossPrevention.enabled &&
      config.ops.lossPrevention.paymentGuardrailsEnabled;

    const snapshot = await loadSessionPaymentSnapshot(admin, sessionId);
    const openBalance = snapshot?.openBalance ?? 0;
    const balanceCheck = paymentGuardrailsEnabled
      ? evaluateSessionCloseBalance({ openBalance, reason: closeReason })
      : { allowed: true as const };

    if (!balanceCheck.allowed) {
      return apiError(balanceCheck.error ?? "Cannot close session.", balanceCheck.status ?? 400);
    }

    await closeTableSession(admin, sessionId);

    if (balanceCheck.riskFlag) {
      await recordSensitiveAction(admin, {
        sessionId,
        action: "session_close",
        targetType: "session",
        targetId: sessionId,
        actorStaffId: staff.id,
        reason: closeReason,
        riskFlag: true,
        context: {
          openBalance,
        },
      });
    }

    return apiSuccess({ closed: true });
  }
);
