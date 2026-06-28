import { NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { getCurrentStaff, getStaffLocationId } from "@/lib/auth/session";
import { loadStaffNotifications } from "@/lib/denis/notifications/persist-staff-notification";
import { withStaffRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export const GET = withErrorHandler(
  "dashboard-staff-notifications-get",
  async (req, _ctx) => {
    const limited = await withStaffRateLimit(req);
    if (limited) return limited;

    const staff = await getCurrentStaff();
    if (!staff) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const unreadOnly = searchParams.get("unread") === "1";
    const limit = Math.min(
      50,
      Math.max(1, Number(searchParams.get("limit") ?? 20) || 20)
    );

    const locationId = await getStaffLocationId(staff);
    if (!locationId) {
      return NextResponse.json({ error: "No location assigned." }, { status: 400 });
    }

    const admin = createAdminClient();
    const notifications = await loadStaffNotifications(admin, {
      orgId: staff.org_id,
      locationId,
      limit,
      unreadOnly,
    });

    const unreadCount = notifications.filter((row) => !row.readAt).length;

    return NextResponse.json({
      notifications,
      unreadCount: unreadOnly ? unreadCount : undefined,
    });
  }
);
