/**
 * ADR-024 — stable permission keys. Amend ADR before adding keys.
 */

export type PermissionKey =
  // Operations (§4.1)
  | "orders.read"
  | "orders.read.drinks"
  | "orders.read.food"
  | "orders.update_status"
  | "orders.create"
  | "orders.cancel"
  | "tables.read"
  | "tables.manage"
  | "calls.manage"
  | "sessions.read"
  | "sessions.close"
  | "payments.collect"
  | "payments.refund"
  | "analytics.read"
  | "denis.ops.read"
  // Administration (§4.2)
  | "menu.read"
  | "menu.edit"
  | "staff.read"
  | "staff.manage"
  | "settings.manage"
  | "billing.manage"
  // Fiscal & compliance (§4.3)
  | "fiscal.shift.read"
  | "fiscal.report.daily"
  | "fiscal.shift.close"
  | "fiscal.receipt.read"
  | "fiscal.storno.execute"
  | "fiscal.export.accounting"
  | "fiscal.export.audit"
  | "fiscal.register.read"
  | "fiscal.register.manage"
  // Cross-surface (§3.3)
  | "surface.waiter.access"
  | "surface.bar.access"
  | "surface.kitchen.access"
  | "surface.dashboard.access"
  | "surface.admin.access"
  | "surface.fiscal.access";

export type PermissionDomain =
  | "operations"
  | "administration"
  | "fiscal"
  | "surface";

export type PermissionMeta = {
  domain: PermissionDomain;
  label: string;
  description: string;
};

export const PERMISSION_CATALOG: Record<PermissionKey, PermissionMeta> = {
  "orders.read": {
    domain: "operations",
    label: "View orders",
    description: "View orders at assigned locations",
  },
  "orders.read.drinks": {
    domain: "operations",
    label: "Drink tickets",
    description: "Drink tickets only (bar station filter)",
  },
  "orders.read.food": {
    domain: "operations",
    label: "Food tickets",
    description: "Food tickets only (kitchen station filter)",
  },
  "orders.update_status": {
    domain: "operations",
    label: "Update order status",
    description: "pending → preparing → ready → delivered",
  },
  "orders.create": {
    domain: "operations",
    label: "Create orders",
    description: "Staff/waiter manual order",
  },
  "orders.cancel": {
    domain: "operations",
    label: "Cancel orders",
    description: "Cancel before kitchen accept (policy-bound)",
  },
  "tables.read": {
    domain: "operations",
    label: "View tables",
    description: "View table map / sessions",
  },
  "tables.manage": {
    domain: "operations",
    label: "Manage tables",
    description: "PIN, transfer, device block",
  },
  "calls.manage": {
    domain: "operations",
    label: "Waiter calls",
    description: "Waiter call queue",
  },
  "sessions.read": {
    domain: "operations",
    label: "View sessions",
    description: "View open table sessions",
  },
  "sessions.close": {
    domain: "operations",
    label: "Close sessions",
    description: "Close session / bill",
  },
  "payments.collect": {
    domain: "operations",
    label: "Collect payments",
    description: "Terminal, card-at-table, cash mark-paid",
  },
  "payments.refund": {
    domain: "operations",
    label: "Refund payments",
    description: "Refund (high sensitivity)",
  },
  "analytics.read": {
    domain: "operations",
    label: "Analytics",
    description: "History, revenue summaries",
  },
  "denis.ops.read": {
    domain: "operations",
    label: "Denis ops",
    description: "Denis ops / copilot panel",
  },
  "menu.read": {
    domain: "administration",
    label: "View menu",
    description: "View menu",
  },
  "menu.edit": {
    domain: "administration",
    label: "Edit menu",
    description: "Menu CRUD",
  },
  "staff.read": {
    domain: "administration",
    label: "View team",
    description: "View team list",
  },
  "staff.manage": {
    domain: "administration",
    label: "Manage team",
    description: "Invite, activate, edit permissions",
  },
  "settings.manage": {
    domain: "administration",
    label: "Settings",
    description: "Location, printers, integrations",
  },
  "billing.manage": {
    domain: "administration",
    label: "Billing",
    description: "Stripe, subscription",
  },
  "fiscal.shift.read": {
    domain: "fiscal",
    label: "View shifts",
    description: "View shift totals, Z-Bon history",
  },
  "fiscal.report.daily": {
    domain: "fiscal",
    label: "Daily report",
    description: "Operational daily report (no TSE sign)",
  },
  "fiscal.shift.close": {
    domain: "fiscal",
    label: "Close shift",
    description: "Tagesabschluss / Z-Bon via fiscal pipeline",
  },
  "fiscal.receipt.read": {
    domain: "fiscal",
    label: "View receipts",
    description: "Beleg / receipt preview",
  },
  "fiscal.storno.execute": {
    domain: "fiscal",
    label: "Storno",
    description: "Storno through fiscal pipeline",
  },
  "fiscal.export.accounting": {
    domain: "fiscal",
    label: "DATEV export",
    description: "DATEV export",
  },
  "fiscal.export.audit": {
    domain: "fiscal",
    label: "DSFinV-K export",
    description: "DSFinV-K export",
  },
  "fiscal.register.read": {
    domain: "fiscal",
    label: "Register status",
    description: "TSE / register status",
  },
  "fiscal.register.manage": {
    domain: "fiscal",
    label: "Manage register",
    description: "Provision, Kassenmeldung",
  },
  "surface.waiter.access": {
    domain: "surface",
    label: "Waiter app",
    description: "May open waiter app",
  },
  "surface.bar.access": {
    domain: "surface",
    label: "Bar app",
    description: "May open bar app",
  },
  "surface.kitchen.access": {
    domain: "surface",
    label: "Kitchen KDS",
    description: "May open kitchen KDS",
  },
  "surface.dashboard.access": {
    domain: "surface",
    label: "Ops dashboard",
    description: "May open ops dashboard",
  },
  "surface.admin.access": {
    domain: "surface",
    label: "Admin back-office",
    description: "May open admin back-office",
  },
  "surface.fiscal.access": {
    domain: "surface",
    label: "Fiscal tablet",
    description: "May open dedicated fiscal tablet app",
  },
};

export const ALL_PERMISSIONS: readonly PermissionKey[] = Object.keys(
  PERMISSION_CATALOG
) as PermissionKey[];

export const OPERATIONS_PERMISSIONS = ALL_PERMISSIONS.filter(
  (key) => PERMISSION_CATALOG[key].domain === "operations"
);

export const ADMIN_PERMISSIONS = ALL_PERMISSIONS.filter(
  (key) => PERMISSION_CATALOG[key].domain === "administration"
);

export const FISCAL_PERMISSIONS = ALL_PERMISSIONS.filter(
  (key) => PERMISSION_CATALOG[key].domain === "fiscal"
);

export const SURFACE_PERMISSIONS = ALL_PERMISSIONS.filter(
  (key) => PERMISSION_CATALOG[key].domain === "surface"
);
