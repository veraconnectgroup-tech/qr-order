export const DASHBOARD_PAGES: Record<
  string,
  { title: string; subtitle?: string }
> = {
  "/dashboard/orders": {
    title: "Live Orders",
    subtitle: "Real-time kanban board",
  },
  "/dashboard/kitchen": {
    title: "Prep Display",
    subtitle: "Food & drinks on one ticket",
  },
  "/dashboard/tables": {
    title: "Tables",
    subtitle: "Floor plan & QR codes",
  },
  "/dashboard/waiter-calls": {
    title: "Waiter Calls",
    subtitle: "Guest requests",
  },
  "/dashboard/history": {
    title: "History",
    subtitle: "Orders & analytics",
  },
  "/dashboard/menu": {
    title: "Menu",
    subtitle: "Categories & products",
  },
  "/dashboard/staff": {
    title: "Staff",
    subtitle: "Team & invites",
  },
  "/dashboard/settings": {
    title: "Settings",
    subtitle: "Restaurant configuration",
  },
};

export function getDashboardPageMeta(pathname: string) {
  const match = Object.entries(DASHBOARD_PAGES).find(([path]) =>
    pathname.startsWith(path)
  );
  return match?.[1] ?? { title: "Dashboard" };
}
