import type { Staff } from "@/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadStaffPermissionOverrides } from "@/lib/auth/load-staff-permission-overrides";
import {
  resolveStaffAccess,
  type StaffAccess,
} from "@/lib/auth/staff-access";

export async function getStaffAccess(
  staff: Pick<Staff, "id" | "role">
): Promise<StaffAccess> {
  const admin = createAdminClient();
  const overrides = await loadStaffPermissionOverrides(admin, staff.id);
  return resolveStaffAccess(staff, overrides);
}
