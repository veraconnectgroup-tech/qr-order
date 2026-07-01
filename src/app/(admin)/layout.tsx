import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { getStaffLocationContext, requireAdmin } from "@/lib/auth/session";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await requireAdmin();
  const { locationId, accessibleLocations } = await getStaffLocationContext(staff);

  return (
    <div className="admin-theme flex min-h-dvh overflow-x-hidden bg-background text-foreground">
      <AdminSidebar
        locations={accessibleLocations.map((l) => ({ id: l.id, name: l.name }))}
        currentLocationId={locationId ?? accessibleLocations[0]?.id ?? ""}
      />
      <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-6">
        {children}
      </main>
    </div>
  );
}
