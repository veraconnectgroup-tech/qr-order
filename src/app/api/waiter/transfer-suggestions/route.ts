import { NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { getCurrentStaff, getStaffLocationId } from "@/lib/auth/session";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import { readFloorGraphCache } from "@/lib/denis/venue/floor/floor-cache";
import { loadFloorGraph } from "@/lib/denis/venue/floor/load-floor-graph";
import { buildTransferSuggestionsForCopilot } from "@/lib/denis/venue/copilot/build-transfer-suggestions";
import { withStaffRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export const GET = withErrorHandler(
  "waiter-transfer-suggestions-get",
  async (req, _ctx) => {
    const limited = await withStaffRateLimit(req);
    if (limited) return limited;

    const staff = await getCurrentStaff();
    if (!staff) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const locationId = await getStaffLocationId(staff);
    if (!locationId) {
      return NextResponse.json({ error: "No location assigned." }, { status: 400 });
    }

    const config = await loadConciergeConfigForLocation(locationId);
    if (!config.enabled) {
      return NextResponse.json({ suggestions: [] });
    }

    const admin = createAdminClient();
    const floor =
      (await readFloorGraphCache(locationId)) ??
      (await loadFloorGraph(admin, locationId, {
        backlogThresholdMinutes: config.ops.autoRushBacklogMinutes,
      }));

    const { data: tableRows } = await admin
      .from("tables")
      .select("id, name, seats")
      .eq("location_id", locationId)
      .eq("is_active", true)
      .is("deleted_at", null);

    const suggestions = await buildTransferSuggestionsForCopilot(admin, {
      locationId,
      floor,
      tableRows: (tableRows ?? []) as Array<{
        id: string;
        name: string;
        seats: number | null;
      }>,
      partyMode: config.party.mode,
    });

    return NextResponse.json({ suggestions });
  }
);
