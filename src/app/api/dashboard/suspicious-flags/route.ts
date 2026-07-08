import { NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { getStaffLocationId } from "@/lib/auth/session";
import {
  ApiUnauthorizedError,
  requireStaffPermission,
} from "@/lib/auth/require-staff-permission";
import { loadOpenSuspiciousFlags } from "@/lib/loss-prevention/load-open-suspicious-flags";
import { withStaffRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export const GET = withErrorHandler(
  "dashboard-suspicious-flags-get",
  async (req, _ctx) => {
    const limited = await withStaffRateLimit(req);
    if (limited) return limited;

    try {
      const staff = await requireStaffPermission("audit.suspicious.view");
      const locationId = await getStaffLocationId(staff);
      if (!locationId) {
        return NextResponse.json(
          { error: "No location assigned." },
          { status: 400 }
        );
      }

      const { searchParams } = new URL(req.url);
      const limit = Math.min(
        50,
        Math.max(1, Number(searchParams.get("limit") ?? 20) || 20)
      );

      const admin = createAdminClient();
      const flags = await loadOpenSuspiciousFlags(admin, locationId, { limit });

      return NextResponse.json({ flags, count: flags.length });
    } catch (error) {
      if (error instanceof ApiUnauthorizedError) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
      }
      throw error;
    }
  }
);
