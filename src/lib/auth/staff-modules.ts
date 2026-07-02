import type { PermissionKey } from "@/lib/auth/permission-catalog";
import type { StaffSurface } from "@/lib/auth/role-templates";

export type StaffAccessModulesInput = {
  permissions: Set<PermissionKey>;
  allowedSurfaces: StaffSurface[];
};

export type StaffModule = {
  id: string;
  surface: StaffSurface;
  label: string;
  href: string;
  /** Single permission or OR-list (any match grants module). */
  requiredPermissions: PermissionKey | PermissionKey[];
};

export const STAFF_MODULE_REGISTRY: readonly StaffModule[] = [
  // Waiter (ADR-024 §7)
  {
    id: "orders",
    surface: "waiter",
    label: "Orders",
    href: "/waiter/orders",
    requiredPermissions: "orders.read",
  },
  {
    id: "tables",
    surface: "waiter",
    label: "Tables",
    href: "/waiter/tables",
    requiredPermissions: "tables.read",
  },
  {
    id: "calls",
    surface: "waiter",
    label: "Calls",
    href: "/waiter/calls",
    requiredPermissions: "calls.manage",
  },
  {
    id: "new-order",
    surface: "waiter",
    label: "New order",
    href: "/waiter/new-order",
    requiredPermissions: "orders.create",
  },
  {
    id: "fiscal-report",
    surface: "waiter",
    label: "Daily report",
    href: "/waiter/fiscal",
    requiredPermissions: "fiscal.report.daily",
  },
  {
    id: "fiscal-close",
    surface: "waiter",
    label: "Close shift",
    href: "/waiter/fiscal",
    requiredPermissions: "fiscal.shift.close",
  },
  {
    id: "payments",
    surface: "waiter",
    label: "Pay",
    href: "/waiter/payments",
    requiredPermissions: "payments.collect",
  },
  // Bar (ADR-024 §7)
  {
    id: "queue",
    surface: "bar",
    label: "Drink queue",
    href: "/bar",
    requiredPermissions: "orders.read.drinks",
  },
  {
    id: "fiscal-close",
    surface: "bar",
    label: "Close shift",
    href: "/bar/fiscal",
    requiredPermissions: "fiscal.shift.close",
  },
  // Kitchen (ADR-024 §7)
  {
    id: "kds",
    surface: "kitchen",
    label: "KDS",
    href: "/kitchen",
    requiredPermissions: "orders.read.food",
  },
  // Dashboard ops (maps legacy sidebar for cross-surface staff)
  {
    id: "dashboard-overview",
    surface: "dashboard",
    label: "Overview",
    href: "/dashboard",
    requiredPermissions: ["orders.read", "analytics.read"],
  },
  {
    id: "dashboard-orders",
    surface: "dashboard",
    label: "Orders",
    href: "/dashboard/orders",
    requiredPermissions: "orders.read",
  },
  {
    id: "dashboard-new-order",
    surface: "dashboard",
    label: "New Order",
    href: "/dashboard/new-order",
    requiredPermissions: "orders.create",
  },
  {
    id: "dashboard-tables",
    surface: "dashboard",
    label: "Tables",
    href: "/dashboard/tables",
    requiredPermissions: "tables.read",
  },
  {
    id: "dashboard-waiter-calls",
    surface: "dashboard",
    label: "Waiter Calls",
    href: "/dashboard/waiter-calls",
    requiredPermissions: "calls.manage",
  },
  {
    id: "dashboard-operations",
    surface: "dashboard",
    label: "Operations",
    href: "/dashboard/operations",
    requiredPermissions: "denis.ops.read",
  },
  {
    id: "kitchen-link",
    surface: "dashboard",
    label: "Prep display",
    href: "/kitchen",
    requiredPermissions: ["surface.kitchen.access", "orders.read"],
  },
  {
    id: "kds",
    surface: "kitchen",
    label: "KDS",
    href: "/kitchen",
    requiredPermissions: "orders.read.food",
  },
  {
    id: "dashboard-history",
    surface: "dashboard",
    label: "History",
    href: "/dashboard/history",
    requiredPermissions: "analytics.read",
  },
  {
    id: "dashboard-menu",
    surface: "dashboard",
    label: "Menu",
    href: "/dashboard/menu",
    requiredPermissions: "menu.read",
  },
  {
    id: "dashboard-staff",
    surface: "dashboard",
    label: "Staff",
    href: "/dashboard/staff",
    requiredPermissions: "staff.read",
  },
  {
    id: "dashboard-settings",
    surface: "dashboard",
    label: "Settings",
    href: "/dashboard/settings",
    requiredPermissions: "settings.manage",
  },
  {
    id: "dashboard-denis",
    surface: "dashboard",
    label: "Denis",
    href: "/dashboard/denis",
    requiredPermissions: "denis.ops.read",
  },
  // Admin (ADR-024 §7)
  {
    id: "tagesabschluss",
    surface: "admin",
    label: "Tagesabschluss",
    href: "/admin/tagesabschluss",
    requiredPermissions: "fiscal.shift.close",
  },
  {
    id: "dsfinvk",
    surface: "admin",
    label: "DSFinV-K",
    href: "/admin/tagesabschluss",
    requiredPermissions: "fiscal.export.audit",
  },
];

/** Primary waiter bottom-nav hrefs — extras come from registry (More / Fiscal). */
export const WAITER_PRIMARY_NAV_HREFS = new Set([
  "/waiter",
  "/waiter/orders",
  "/waiter/new-order",
  "/waiter/calls",
  "/waiter/tables",
]);

function moduleAllowed(
  permissions: Set<PermissionKey>,
  required: PermissionKey | PermissionKey[]
): boolean {
  const keys = Array.isArray(required) ? required : [required];
  return keys.some((permission) => permissions.has(permission));
}

export function computeModulesForSurface(
  access: StaffAccessModulesInput,
  surface: StaffSurface
): StaffModule[] {
  return STAFF_MODULE_REGISTRY.filter(
    (module) =>
      module.surface === surface &&
      moduleAllowed(access.permissions, module.requiredPermissions)
  );
}

export function computeModulesForSurfaces(
  access: StaffAccessModulesInput
): StaffModule[] {
  return access.allowedSurfaces.flatMap((surface) =>
    computeModulesForSurface(access, surface)
  );
}

/** Waiter nav modules not shown on the primary bottom bar (More / Fiscal). */
export function computeWaiterExtraNavModules(
  access: StaffAccessModulesInput
): StaffModule[] {
  const seen = new Set<string>();
  const extras: StaffModule[] = [];

  for (const navModule of computeModulesForSurface(access, "waiter")) {
    if (WAITER_PRIMARY_NAV_HREFS.has(navModule.href)) {
      continue;
    }
    const key = navModule.href;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    extras.push(navModule);
  }

  return extras;
}

export function computeDashboardNavHrefs(
  access: StaffAccessModulesInput
): Set<string> {
  return new Set(
    computeModulesForSurface(access, "dashboard").map((module) => module.href)
  );
}
