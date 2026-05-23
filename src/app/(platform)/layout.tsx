import { PlatformSidebar } from "@/components/platform/platform-sidebar";
import { requirePlatformAdmin } from "@/lib/auth/session";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePlatformAdmin();

  return (
    <div className="flex min-h-screen bg-neutral-50 text-neutral-950">
      <PlatformSidebar />
      <main className="flex-1 overflow-auto p-6 md:p-8">{children}</main>
    </div>
  );
}
