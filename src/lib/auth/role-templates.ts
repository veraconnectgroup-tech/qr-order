import type { StaffRole } from "@/types";
import {
  ALL_PERMISSIONS,
  type PermissionKey,
} from "@/lib/auth/permission-catalog";

export type StaffTemplateRole = StaffRole;

export type StaffSurface =
  | "waiter"
  | "bar"
  | "kitchen"
  | "dashboard"
  | "admin"
  | "fiscal";

export const SURFACE_PATHS: Record<StaffSurface, string> = {
  waiter: "/waiter",
  bar: "/bar",
  kitchen: "/kitchen",
  dashboard: "/dashboard",
  admin: "/admin",
  fiscal: "/fiscal",
};

export function surfaceToPath(surface: StaffSurface): string {
  return SURFACE_PATHS[surface];
}

const WAITER_PERMISSIONS: readonly PermissionKey[] = [
  "orders.read",
  "orders.update_status",
  "orders.create",
  "orders.cancel",
  "tables.read",
  "calls.manage",
  "sessions.read",
  "payments.collect",
];

const STAFF_PERMISSIONS: readonly PermissionKey[] = [
  ...WAITER_PERMISSIONS,
  "tables.manage",
  "sessions.close",
  "analytics.read",
];

const MANAGER_PERMISSIONS: readonly PermissionKey[] = [
  ...STAFF_PERMISSIONS,
  "menu.read",
  "menu.edit",
  "staff.read",
  "staff.manage",
  "settings.manage",
  "fiscal.shift.read",
  "fiscal.report.daily",
  "fiscal.shift.close",
  "fiscal.export.accounting",
  "payments.refund",
  "surface.admin.access",
  "denis.ops.read",
];

/** Default permission bundles — versioned in code (ADR-024 §5). */
export const ROLE_TEMPLATES: Record<
  StaffTemplateRole,
  readonly PermissionKey[]
> = {
  waiter: WAITER_PERMISSIONS,
  bar: [
    "orders.read.drinks",
    "orders.update_status",
    "payments.collect",
    "orders.create",
  ],
  kitchen: ["orders.read.food", "orders.update_status"],
  staff: STAFF_PERMISSIONS,
  manager: MANAGER_PERMISSIONS,
  owner: ALL_PERMISSIONS,
};

export const PRIMARY_SURFACE: Record<StaffTemplateRole, StaffSurface> = {
  waiter: "waiter",
  bar: "bar",
  kitchen: "kitchen",
  staff: "dashboard",
  manager: "dashboard",
  owner: "dashboard",
};
