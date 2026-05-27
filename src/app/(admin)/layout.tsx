import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { requireAdmin } from "@/lib/auth/session";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <div className="admin-theme flex min-h-dvh overflow-x-hidden bg-background text-foreground">
      <AdminSidebar />
      <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-6">
        {children}
      </main>
    </div>
  );
}
