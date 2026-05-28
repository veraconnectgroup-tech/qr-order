import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { validateTableSession } from "@/lib/orders/validate-table-session";
import { withGuestRateLimits } from "@/lib/rate-limit";
import { resolveOrgIdFromTableToken } from "@/lib/rate-limit/org-context";
import { zSessionToken, zTableToken } from "@/lib/security/zod-fields";
import { createAdminClient } from "@/lib/supabase/admin";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(512),
  }),
});

const schema = z.object({
  tableToken: zTableToken(),
  sessionToken: zSessionToken(),
  subscription: subscriptionSchema,
});

/** Guest PWA push opt-in — session-scoped (ADR-019 Phase D). */
export const POST = withErrorHandler(
  "guest-push-subscribe-post",
  async (req, _ctx) => {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return apiError("Invalid input.", 400);
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid input.", 400);
    }

    const orgId = await resolveOrgIdFromTableToken(parsed.data.tableToken);
    const limited = await withGuestRateLimits(req, "sessions", orgId);
    if (limited) return limited;

    const admin = createAdminClient();
    const sessionResult = await validateTableSession(
      admin,
      parsed.data.tableToken,
      parsed.data.sessionToken
    );

    if ("error" in sessionResult) {
      return apiError(sessionResult.error, sessionResult.status);
    }

    const { session, table } = sessionResult.data;
    const { subscription } = parsed.data;

    const { error } = await admin.from("guest_push_subscriptions" as never).upsert(
      {
        session_id: session.id,
        location_id: table.location_id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      } as never,
      { onConflict: "session_id,endpoint" }
    );

    if (error) {
      if (error.code === "42P01") {
        return apiError("Push not available.", 503);
      }
      return apiError("Could not save subscription.", 500);
    }

    return apiSuccess({ ok: true });
  }
);
