import {
  ALL_PERMISSIONS,
  type PermissionKey,
} from "@/lib/auth/permission-catalog";
import {
  ROLE_TEMPLATES,
  type StaffTemplateRole,
} from "@/lib/auth/role-templates";
import type { PermissionOverride } from "@/lib/auth/staff-access";

/** Overrides to persist: only rows that differ from the role template. */
export function computeOverridesForStorage(
  role: StaffTemplateRole,
  effective: Set<PermissionKey>
): PermissionOverride[] {
  const template = new Set(ROLE_TEMPLATES[role] ?? []);
  const overrides: PermissionOverride[] = [];

  for (const permission of ALL_PERMISSIONS) {
    const inTemplate = template.has(permission);
    const inEffective = effective.has(permission);
    if (inTemplate !== inEffective) {
      overrides.push({ permission, granted: inEffective });
    }
  }

  return overrides;
}

export function parsePermissionOverridesJson(
  value: unknown
): PermissionOverride[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const overrides: PermissionOverride[] = [];
  for (const item of value) {
    if (
      item &&
      typeof item === "object" &&
      "permission" in item &&
      "granted" in item &&
      typeof item.permission === "string" &&
      typeof item.granted === "boolean" &&
      ALL_PERMISSIONS.includes(item.permission as PermissionKey)
    ) {
      overrides.push({
        permission: item.permission as PermissionKey,
        granted: item.granted,
      });
    }
  }
  return overrides;
}
