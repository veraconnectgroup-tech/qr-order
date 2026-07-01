import { NextResponse } from "next/server";
import { loadDenisInsightsAggregate } from "@/lib/admin/denis-debug";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { getStaffLocationId, requireAdmin } from "@/lib/auth/session";
import { withStaffRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export const GET = withErrorHandler(
  "admin-denis-insights-aggregate-get",
  async (req, _ctx) => {
    const limited = await withStaffRateLimit(req);
    if (limited) return limited;

    const staff = await requireAdmin();
    const locationId = await getStaffLocationId(staff);
    if (!locationId) {
      return NextResponse.json({ error: "No location assigned." }, { status: 400 });
    }

    const days = Math.min(
      30,
      Math.max(1, Number(new URL(req.url).searchParams.get("days") ?? 14) || 14)
    );

    const admin = createAdminClient();
    const aggregate = await loadDenisInsightsAggregate(admin, locationId, days);

    return NextResponse.json({ aggregate });
  }
);
