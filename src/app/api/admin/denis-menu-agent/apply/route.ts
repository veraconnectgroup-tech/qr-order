import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { getStaffLocationId, requireAdmin } from "@/lib/auth/session";
import { executeMenuChangeProposal } from "@/lib/denis/menu-agent/execute-menu-change-proposal";
import { withStaffRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  proposal: z.record(z.string(), z.unknown()),
});

/**
 * Sole endpoint that turns a menu-agent proposal into a real write — only
 * ever called when the owner clicks Primeni on a specific proposal card.
 * Re-validates the proposal from scratch (Zod + truth checks in
 * execute-menu-change-proposal.ts) rather than trusting anything the chat
 * turn produced.
 */
export const POST = withErrorHandler(
  "admin-denis-menu-agent-apply-post",
  async (req, _ctx) => {
    const limited = await withStaffRateLimit(req);
    if (limited) return limited;

    const staff = await requireAdmin();
    const locationId = await getStaffLocationId(staff);
    if (!locationId) {
      return apiError("No location assigned.", 400);
    }

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return apiError("Invalid input.", 400, parsed.error.flatten());
    }

    const admin = createAdminClient();
    const result = await executeMenuChangeProposal({
      admin,
      locationId,
      proposal: parsed.data.proposal,
    });

    if (!result.ok) {
      return apiError(result.error, result.status);
    }

    return apiSuccess({ productId: result.productId });
  }
);
