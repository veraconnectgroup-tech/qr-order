import type { SupabaseClient } from "@supabase/supabase-js";

const ACTIVE_WINDOW_MS = 15 * 60_000;

const FLOOR_STAFF_ROLES = [
  "owner",
  "manager",
  "staff",
  "waiter",
  "bar",
] as const;

type LocationRow = { org_id: string };

type StaffRow = {
  id: string;
  user_id: string;
  location_id: string | null;
  role: string;
};

type StaffLocationRow = { staff_id: string };

type AuditRow = { user_id: string | null };

/**
 * Count floor staff with recent dashboard activity (C2).
 * No `staff_sessions` table — uses audit_log user_id in a 15-minute window.
 */
export async function countActiveStaffOnFloor(
  admin: SupabaseClient,
  locationId: string
): Promise<number | null> {
  const { data: locationRow, error: locationError } = await admin
    .from("locations")
    .select("org_id")
    .eq("id", locationId)
    .maybeSingle();

  if (locationError || !locationRow) {
    return null;
  }

  const location = locationRow as LocationRow;
  const since = new Date(Date.now() - ACTIVE_WINDOW_MS).toISOString();

  const { data: auditRows, error: auditError } = await admin
    .from("audit_log")
    .select("user_id")
    .eq("org_id", location.org_id)
    .gte("created_at", since)
    .not("user_id", "is", null);

  if (auditError) {
    return null;
  }

  const activeUserIds = new Set<string>();
  for (const row of (auditRows ?? []) as AuditRow[]) {
    if (row.user_id) activeUserIds.add(row.user_id);
  }

  if (activeUserIds.size === 0) {
    return 0;
  }

  const [{ data: staffRows }, { data: assignedRows }] = await Promise.all([
    admin
      .from("staff")
      .select("id, user_id, location_id, role")
      .eq("org_id", location.org_id)
      .eq("is_active", true)
      .is("deleted_at", null)
      .in("role", [...FLOOR_STAFF_ROLES]),
    admin
      .from("staff_locations")
      .select("staff_id")
      .eq("location_id", locationId),
  ]);

  const assignedStaffIds = new Set<string>();
  for (const row of (assignedRows ?? []) as StaffLocationRow[]) {
    assignedStaffIds.add(row.staff_id);
  }

  let count = 0;
  for (const staff of (staffRows ?? []) as StaffRow[]) {
    if (!activeUserIds.has(staff.user_id)) continue;
    if (staff.location_id === locationId || assignedStaffIds.has(staff.id)) {
      count++;
    }
  }

  return count;
}
