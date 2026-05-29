import { getCurrentStaff } from "@/lib/auth/session";
import { loadStaffPermissionOverrides } from "@/lib/auth/load-staff-permission-overrides";
import type { PermissionKey } from "@/lib/auth/permission-catalog";
import {
  assertPermission,
  can,
  resolveStaffAccess,
  type AccessContext,
} from "@/lib/auth/staff-access";
import { createAdminClient } from "@/lib/supabase/admin";

export class ApiUnauthorizedError extends Error {
  readonly statusCode = 401;

  constructor() {
    super("Unauthorized.");
    this.name = "ApiUnauthorizedError";
  }
}

type CurrentStaff = NonNullable<Awaited<ReturnType<typeof getCurrentStaff>>>;

async function loadOverrides(staffId: string) {
  const admin = createAdminClient();
  return loadStaffPermissionOverrides(admin, staffId);
}

export async function requireStaffPermission(
  permission: PermissionKey,
  ctx?: AccessContext
): Promise<CurrentStaff> {
  const staff = await getCurrentStaff();
  if (!staff) {
    throw new ApiUnauthorizedError();
  }

  const overrides = await loadOverrides(staff.id);
  assertPermission(staff, permission, overrides, ctx);
  return staff;
}

export async function requireStaffAnyPermission(
  permissions: PermissionKey[],
  ctx?: AccessContext
): Promise<CurrentStaff> {
  const staff = await getCurrentStaff();
  if (!staff) {
    throw new ApiUnauthorizedError();
  }

  const overrides = await loadOverrides(staff.id);
  const access = resolveStaffAccess(staff, overrides);

  if (permissions.some((permission) => can(access, permission, ctx))) {
    return staff;
  }

  assertPermission(staff, permissions[0]!, overrides, ctx);
  return staff;
}
