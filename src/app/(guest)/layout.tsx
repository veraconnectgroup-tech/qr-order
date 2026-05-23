import { GuestPwaInstallSheet } from "@/components/guest/guest-pwa-install-sheet";

export default function GuestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="guest-theme min-h-dvh overflow-x-hidden bg-background text-foreground">
      {children}
      <GuestPwaInstallSheet />
    </div>
  );
}
