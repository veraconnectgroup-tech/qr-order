import { GuestPwaInstallSheet } from "@/components/guest/guest-pwa-install-sheet";
import { GuestPwaTracker } from "@/components/guest/guest-pwa-tracker";

export default function GuestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="guest-theme min-h-dvh overflow-x-hidden bg-background text-foreground">
      {/* Fallback if a stale SW blocked Tailwind — keeps menu readable until reload */}
      <style
        dangerouslySetInnerHTML={{
          __html: `.guest-theme{background:#0a0a0a;color:#fafafa;font-family:var(--font-sans,system-ui,sans-serif)}`,
        }}
      />
      <GuestPwaTracker />
      {children}
      <GuestPwaInstallSheet />
    </div>
  );
}
