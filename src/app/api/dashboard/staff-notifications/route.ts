import { NextResponse } from "next/server";
import { getCurrentStaff, getStaffLocationId } from "@/lib/auth/session";
import { loadStaffNotifications } from "@/lib/denis/notifications/persist-staff-notification";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const staff = await getCurrentStaff();
  if (!staff) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
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
