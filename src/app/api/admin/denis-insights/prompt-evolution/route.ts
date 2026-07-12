import { NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { getStaffLocationId, requireAdmin } from "@/lib/auth/session";
import { loadPromptEvolutionStatus } from "@/lib/denis/knowledge/evolved-learnings-store";
import { withStaffRateLimit } from "@/lib/rate-limit";

/**
 * Read-only view onto the prompt-evolution shadow flywheel
 * (runPromptEvolutionShadow, wired in the session.eval outbox handler).
 * Shows what the flywheel WOULD change about Denis's prompt for this
 * location — never applied automatically. Applying an evolved section to
 * the live system prompt is a separate, not-yet-built decision that
 * requires explicit founder review of the diff shown here first.
 */
export const GET = withErrorHandler(
  "admin-denis-prompt-evolution-get",
  async (req, _ctx) => {
    const limited = await withStaffRateLimit(req);
    if (limited) return limited;

    const staff = await requireAdmin();
    const locationId = await getStaffLocationId(staff);
    if (!locationId) {
      return NextResponse.json({ error: "No location assigned." }, { status: 400 });
    }

    const status = await loadPromptEvolutionStatus(locationId);
    return NextResponse.json({ data: status });
  }
);
