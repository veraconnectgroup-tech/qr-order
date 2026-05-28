import { PlatformSidebar } from "@/components/platform/platform-sidebar";
import { requirePlatformAdmin } from "@/lib/auth/session";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePlatformAdmin();

  return (
    <div className="admin-theme flex min-h-dvh overflow-x-hidden bg-background text-foreground">
      <PlatformSidebar />
      <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-6">
        {children}
      </main>
    </div>
  );
}
