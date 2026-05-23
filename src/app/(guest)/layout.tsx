import { GuestPwaInstallSheet } from "@/components/guest/guest-pwa-install-sheet";
import { GuestPwaTracker } from "@/components/guest/guest-pwa-tracker";

export default function GuestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="guest-theme min-h-dvh overflow-x-hidden bg-background text-foreground">
      <GuestPwaTracker />
      {children}
      <GuestPwaInstallSheet />
    </div>
  );
}
