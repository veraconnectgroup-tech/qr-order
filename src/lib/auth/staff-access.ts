import type { Staff } from "@/types";
import type { PosIntegrationContext } from "@/lib/outbox/types";
import type { PermissionKey } from "@/lib/auth/permission-catalog";
import { runComplianceGuards } from "@/lib/auth/compliance-guards";
import {
  PRIMARY_SURFACE,
  ROLE_TEMPLATES,
  type StaffSurface,
  type StaffTemplateRole,
} from "@/lib/auth/role-templates";
import {
  computeModulesForSurfaces,
  type StaffModule,
} from "@/lib/auth/staff-modules";

export type PermissionOverride = {
  permission: PermissionKey;
  granted: boolean;
};

export type AccessContext = {
  locationId?: string;
  accessibleLocationIds?: string[];
  /** When set, enables standalone fiscal guard in `can()`. */
  posIntegration?: PosIntegrationContext | null;
};

export type StaffAccess = {
  permissions: Set<PermissionKey>;
  primarySurface: StaffSurface;
  allowedSurfaces: StaffSurface[];
  modules: StaffModule[];
};

export type StaffAccessInput = Pick<Staff, "id" | "role">;

const SURFACE_PERMISSION_TO_SURFACE: Partial<
  Record<PermissionKey, StaffSurface>
> = {
  "surface.waiter.access": "waiter",
  "surface.bar.access": "bar",
  "surface.kitchen.access": "kitchen",
  "surface.dashboard.access": "dashboard",
  "surface.admin.access": "admin",
  "surface.fiscal.access": "fiscal",
};

export class PermissionDeniedError extends Error {
  readonly statusCode = 403;
  readonly permission: PermissionKey;

  constructor(permission: PermissionKey) {
    super(`Permission denied: ${permission}`);
    this.name = "PermissionDeniedError";
    this.permission = permission;
  }
}

function isTemplateRole(role: string): role is StaffTemplateRole {
  return role in PRIMARY_SURFACE;
}

export function computeAllowedSurfaces(
  effective: Set<PermissionKey>,
  role: StaffTemplateRole
): StaffSurface[] {
  const surfaces = new Set<StaffSurface>([PRIMARY_SURFACE[role]]);

  for (const [permission, surface] of Object.entries(
    SURFACE_PERMISSION_TO_SURFACE
  ) as Array<[PermissionKey, StaffSurface]>) {
    if (effective.has(permission)) {
      surfaces.add(surface);
    }
  }

  return [...surfaces];
}

export function resolveStaffAccess(
  staff: StaffAccessInput,
  overrides: PermissionOverride[] = []
): StaffAccess {
  const role = isTemplateRole(staff.role) ? staff.role : "staff";
  const template = [...(ROLE_TEMPLATES[role] ?? [])];
  const grants = overrides.filter((o) => o.granted).map((o) => o.permission);
  const revokes = new Set(
    overrides.filter((o) => !o.granted).map((o) => o.permission)
  );

  const effective = new Set<PermissionKey>([...template, ...grants]);

  if (role !== "owner") {
    for (const revoke of revokes) {
      effective.delete(revoke);
    }
  }

  const access: StaffAccess = {
    permissions: effective,
    primarySurface: PRIMARY_SURFACE[role],
    allowedSurfaces: computeAllowedSurfaces(effective, role),
    modules: [],
  };

  access.modules = computeModulesForSurfaces(access);
  return access;
}

export function can(
  access: StaffAccess,
  permission: PermissionKey,
  ctx?: AccessContext
): boolean {
  if (!access.permissions.has(permission)) {
    return false;
  }

  if (
    ctx?.locationId &&
    ctx.accessibleLocationIds &&
    !ctx.accessibleLocationIds.includes(ctx.locationId)
  ) {
    return false;
  }

  return runComplianceGuards(permission, ctx);
}

export function assertPermission(
  staff: StaffAccessInput,
  permission: PermissionKey,
  overrides: PermissionOverride[] = [],
  ctx?: AccessContext
): StaffAccess {
  const access = resolveStaffAccess(staff, overrides);
  if (!can(access, permission, ctx)) {
    throw new PermissionDeniedError(permission);
  }
  return access;
}
