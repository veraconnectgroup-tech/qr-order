import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { loadTodayEightySixItems } from "@/lib/products/eighty-six";
import { withStaffRateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/security/sanitize";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

function dayRangeUtc(date: string): { from: string; to: string } {
  const from = `${date}T00:00:00.000Z`;
  const end = new Date(`${date}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  return { from, to: end.toISOString() };
}

async function verifyStaffLocationAccess(locationId: string) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const admin = createAdminClient();
  const { data: location } = await admin
    .from("locations")
    .select("id, org_id")
    .eq("id", locationId)
    .maybeSingle();

  if (!location) return null;

  const { data: staff } = await supabase
    .from("staff")
    .select("id, org_id, location_id, role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (!staff) return null;

  const staffRow = staff as {
    id: string;
    org_id: string;
    location_id: string | null;
    role: string;
  };

  if (staffRow.org_id !== (location as { org_id: string }).org_id) {
    return null;
  }

  if (staffRow.location_id && staffRow.location_id !== locationId) {
    return null;
  }

  return { staff: staffRow };
}

export const GET = withErrorHandler(
  "locations-locationId-eighty-six-get",
  async (req, ctx) => {
    const limited = await withStaffRateLimit(req);
    if (limited) return limited;

    const { locationId } = await ctx.params;
    if (!isUuid(locationId)) {
      return apiError("Invalid location id.", 400);
    }

    const access = await verifyStaffLocationAccess(locationId);
    if (!access) {
      return apiError("Unauthorized.", 401);
    }

    const url = new URL(req.url);
    const stationParam = url.searchParams.get("station");
    const station =
      stationParam === "kitchen" || stationParam === "bar"
        ? stationParam
        : undefined;

    const date =
      url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
    const range = dayRangeUtc(date);

    const admin = createAdminClient();
    const items = await loadTodayEightySixItems(admin, {
      orgId: access.staff.org_id,
      locationId,
      from: range.from,
      to: range.to,
      station,
    });

    return apiSuccess({ items, date });
  }
);
