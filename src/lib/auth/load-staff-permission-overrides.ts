import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { ALL_PERMISSIONS, type PermissionKey } from "@/lib/auth/permission-catalog";
import type { PermissionOverride } from "@/lib/auth/staff-access";

const PERMISSION_KEY_SET = new Set<string>(ALL_PERMISSIONS);

function isPermissionKey(value: string): value is PermissionKey {
  return PERMISSION_KEY_SET.has(value);
}

/** Loads per-staff permission overrides from Supabase. */
export async function loadStaffPermissionOverrides(
  admin: SupabaseClient<Database>,
  staffId: string
): Promise<PermissionOverride[]> {
  const { data, error } = await admin
    .from("staff_permission_overrides")
    .select("permission, granted")
    .eq("staff_id", staffId);

  if (error) {
    console.error("[loadStaffPermissionOverrides]", error.message);
    return [];
  }

  const overrides: PermissionOverride[] = [];
  for (const row of data ?? []) {
    if (isPermissionKey(row.permission)) {
      overrides.push({
        permission: row.permission,
        granted: row.granted,
      });
    }
  }
  return overrides;
}

/** Batch load overrides for multiple staff (admin UI). */
export async function loadStaffPermissionOverridesBatch(
  admin: SupabaseClient<Database>,
  staffIds: string[]
): Promise<Record<string, PermissionOverride[]>> {
  if (staffIds.length === 0) {
    return {};
  }

  const { data, error } = await admin
    .from("staff_permission_overrides")
    .select("staff_id, permission, granted")
    .in("staff_id", staffIds);

  if (error) {
    console.error("[loadStaffPermissionOverridesBatch]", error.message);
    return {};
  }

  const byStaff: Record<string, PermissionOverride[]> = {};
  for (const row of data ?? []) {
    if (!isPermissionKey(row.permission)) {
      continue;
    }
    const list = byStaff[row.staff_id] ?? [];
    list.push({ permission: row.permission, granted: row.granted });
    byStaff[row.staff_id] = list;
  }
  return byStaff;
}
