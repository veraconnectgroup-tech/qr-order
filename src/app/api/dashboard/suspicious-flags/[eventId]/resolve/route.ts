import { NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import {
  ApiUnauthorizedError,
  requireStaffPermission,
} from "@/lib/auth/require-staff-permission";
import { resolveSuspiciousFlag } from "@/lib/loss-prevention/resolve-suspicious-flag";
import { withStaffRateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/security/sanitize";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  outcome: z.enum(["ok", "problem"]),
});

export const POST = withErrorHandler(
  "dashboard-suspicious-flags-resolve-post",
  async (req, ctx) => {
    const limited = await withStaffRateLimit(req);
    if (limited) return limited;

    try {
      const staff = await requireStaffPermission("audit.suspicious.view");
      const { eventId } = await ctx.params;

      if (!isUuid(eventId)) {
        return NextResponse.json({ error: "Invalid event id." }, { status: 400 });
      }

      const body = await req.json();
      const parsed = bodySchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid input." }, { status: 400 });
      }

      const admin = createAdminClient();
      const result = await resolveSuspiciousFlag(admin, {
        eventId,
        staffId: staff.id,
        outcome: parsed.data.outcome,
      });

      if (!result.ok) {
        return NextResponse.json(
          { error: result.error },
          { status: result.status }
        );
      }

      return NextResponse.json({ resolved: true });
    } catch (error) {
      if (error instanceof ApiUnauthorizedError) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
      }
      throw error;
    }
  }
);
