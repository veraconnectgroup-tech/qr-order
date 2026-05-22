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
        No location found for this account.
      </div>
    );
  }

  const admin = createAdminClient();
  const [{ data: org }, todayRevenue, { count: tableCount }, { count: productCount }] =
    await Promise.all([
    admin
      .from("organizations")
      .select("id, name, slug, currency, stripe_onboarded")
      .eq("id", staff.org_id)
      .single(),
    getTodayRevenue(locationId),
    admin
      .from("tables")
      .select("id", { count: "exact", head: true })
      .eq("location_id", locationId),
    admin
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("location_id", locationId),
  ]);

  const orgRow = org as {
    id: string;
    name: string;
    slug: string;
    currency: string;
    stripe_onboarded: boolean;
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
        stripeOnboarded: orgRow?.stripe_onboarded ?? false,
        hasTables: (tableCount ?? 0) > 0,
        hasMenuItems: (productCount ?? 0) > 0,
      }}
    >
      {children}
    </DashboardShell>
  );
}
