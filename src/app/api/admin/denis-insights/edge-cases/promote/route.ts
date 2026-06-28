import { NextResponse } from "next/server";
import { z } from "zod";
import { promoteUnknownIntentToEvalFixture } from "@/lib/admin/denis-edge-cases";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { getStaffLocationId, requireAdmin } from "@/lib/auth/session";
import { persistAdminEdgeCaseReview } from "@/lib/denis/eval/persist-eval-run";
import { withStaffRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().uuid(),
  guestText: z.string().min(1).max(500),
  denisResponse: z.string().max(2000).nullable().optional(),
  capturedAt: z.string().optional(),
});

export const POST = withErrorHandler(
  "admin-denis-edge-case-promote-post",
  async (req, _ctx) => {
    const limited = await withStaffRateLimit(req);
    if (limited) return limited;

    const staff = await requireAdmin();
    const locationId = await getStaffLocationId(staff);
    if (!locationId) {
      return NextResponse.json({ error: "No location assigned." }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    }

    const edgeCase = {
      id: parsed.data.id,
      sessionId: parsed.data.sessionId,
      guestText: parsed.data.guestText,
      denisResponse: parsed.data.denisResponse ?? null,
      capturedAt: parsed.data.capturedAt ?? new Date().toISOString(),
      reviewed: true,
    };

    const result = await promoteUnknownIntentToEvalFixture(edgeCase);

    const admin = createAdminClient();
    await persistAdminEdgeCaseReview(admin, {
      scenarioId: result.scenarioId,
      sessionId: edgeCase.sessionId,
      guestMessage: edgeCase.guestText,
      promotedBy: staff.user_id,
    });

    return NextResponse.json({
      ok: true,
      scenarioId: result.scenarioId,
      appended: result.appended,
    });
  }
);
