import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getStaffLocationId, requireStaff } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

import { sumOrderRevenue } from "@/lib/orders/revenue";

async function getTodayRevenue(locationId: string) {
  const admin = createAdminClient();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data } = await admin
    .from("orders")
    .select("total, status")
    .eq("location_id", locationId)
    .gte("created_at", todayStart.toISOString())
    .in("status", ["accepted", "preparing", "ready", "delivered"]);

  return sumOrderRevenue(
    (data ?? []) as Array<{ total: number; status: string }>
  );
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await requireStaff();
  const locationId = await getStaffLocationId(staff);

  if (!locationId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        No active location found for this account.
      </div>
    );
  }

  const admin = createAdminClient();
  const [{ data: org }, todayRevenue] = await Promise.all([
    admin
      .from("organizations")
      .select("id, name, slug, currency")
      .eq("id", staff.org_id)
      .single(),
    getTodayRevenue(locationId),
  ]);

  const orgRow = org as {
    id: string;
    name: string;
    slug: string;
    currency: string;
  } | null;

  return (
    <DashboardShell
      context={{
        locationId,
        orgId: staff.org_id,
        orgName: orgRow?.name ?? "Restaurant",
        orgSlug: orgRow?.slug ?? "",
        currency: orgRow?.currency ?? "EUR",
        staffName: staff.name,
        staffRole: staff.role,
        staffEmail: staff.email,
        todayRevenue,
      }}
    >
      {children}
    </DashboardShell>
  );
}
