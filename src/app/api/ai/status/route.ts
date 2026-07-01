import { apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { isOpenAiConfigured } from "@/lib/ai/config";
import { verifyAiGuestContext } from "@/lib/ai/verify-guest-context";
import { withGuestRateLimits } from "@/lib/rate-limit";
import { zSessionToken, zUuid } from "@/lib/security/zod-fields";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const statusSchema = z.object({
  locationId: zUuid(),
  tableId: zUuid(),
  sessionToken: zSessionToken(),
});

/** Guest-facing AI availability check (configuration, flags, credits). */
export const POST = withErrorHandler("ai-status-post", async (req, _ctx) => {
  const limited = await withGuestRateLimits(req, "ai");
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  const parsed = statusSchema.safeParse(body);
  if (!parsed.success) {
    return apiSuccess({
      available: false,
      reason: "invalid_input",
    });
  }

  if (!isOpenAiConfigured()) {
    return apiSuccess({
      available: false,
      reason: "not_configured",
    });
  }

  const admin = createAdminClient();
  const guestContext = await verifyAiGuestContext(admin, parsed.data);

  if ("error" in guestContext) {
    return apiSuccess({
      available: false,
      reason:
        guestContext.status === 403 ? "not_enabled" : "session_invalid",
      message: guestContext.error,
    });
  }

  const { data: creditsRow } = await admin
    .from("ai_credits")
    .select("balance")
    .eq("org_id", guestContext.data.orgId)
    .maybeSingle();

  const balance = (creditsRow as { balance: number } | null)?.balance ?? 0;
  if (balance < 1) {
    return apiSuccess({
      available: false,
      reason: "insufficient_credits",
    });
  }

  return apiSuccess({ available: true, reason: null });
});
