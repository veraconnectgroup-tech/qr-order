import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  ALL_PERMISSIONS,
  type PermissionKey,
} from "@/lib/auth/permission-catalog";
import {
  resolveStaffAccess,
  type StaffAccess,
  type PermissionOverride,
} from "@/lib/auth/staff-access";
import { surfaceToPath } from "@/lib/auth/role-templates";
import type { Staff } from "@/types";

const PERMISSION_KEY_SET = new Set<string>(ALL_PERMISSIONS);

function isPermissionKey(value: string): value is PermissionKey {
  return PERMISSION_KEY_SET.has(value);
}

export async function loadMiddlewareStaffAccess(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<StaffAccess | null> {
  const { data: staff } = await supabase
    .from("staff")
    .select("id, role")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!staff) {
    return null;
  }

  const { data: overrideRows } = await supabase
    .from("staff_permission_overrides")
    .select("permission, granted")
    .eq("staff_id", staff.id);

  const overrides: PermissionOverride[] = [];
  for (const row of overrideRows ?? []) {
    if (isPermissionKey(row.permission)) {
      overrides.push({
        permission: row.permission,
        granted: row.granted,
      });
    }
  }

  return resolveStaffAccess(
    { id: staff.id, role: staff.role as Staff["role"] },
    overrides
  );
}

export function redirectToPrimarySurface(access: StaffAccess): string {
  return surfaceToPath(access.primarySurface);
}
