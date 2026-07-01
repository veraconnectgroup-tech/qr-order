"use client";

import { GuestAccessibilityProvider, useGuestAccessibility } from "@/components/guest/guest-accessibility-provider";
import { GuestPwaInstallBanner } from "@/components/guest/guest-pwa-install-banner";
import { GuestPwaTracker } from "@/components/guest/guest-pwa-tracker";
import { buildGuestThemeStyleBlock } from "@/components/theme/venue-theme-provider";
import {
  guestAccessibilityClassNames,
  guestAccessibilityStyle,
} from "@/lib/denis/cognition/mental-model/accessibility-types";
import type { ResolvedTheme } from "@/lib/theme/types";
import { cn } from "@/lib/utils";

function GuestLayoutFrame({
  children,
  theme,
}: {
  children: React.ReactNode;
  theme?: ResolvedTheme | null;
}) {
  const { prefs } = useGuestAccessibility();
  const themeBlock = theme
    ? buildGuestThemeStyleBlock(theme, prefs.highContrast)
    : null;

  return (
    <div
      className={cn(
        "guest-theme min-h-dvh overflow-x-hidden bg-background text-foreground",
        guestAccessibilityClassNames(prefs)
      )}
      style={guestAccessibilityStyle(prefs)}
      data-color-scheme={theme?.colorScheme ?? "dark"}
    >
      {themeBlock ? (
        <style dangerouslySetInnerHTML={{ __html: themeBlock }} />
      ) : (
        <style
          dangerouslySetInnerHTML={{
            __html: `.guest-theme{background:#0a0a0a;color:#fafafa;font-family:var(--font-sans,system-ui,sans-serif)}`,
          }}
        />
      )}
      <GuestPwaTracker />
      {children}
      <GuestPwaInstallBanner />
    </div>
  );
}

export function GuestAccessibilityLayout({
  children,
  theme,
}: {
  children: React.ReactNode;
  theme?: ResolvedTheme | null;
}) {
  return (
    <GuestAccessibilityProvider>
      <GuestLayoutFrame theme={theme}>{children}</GuestLayoutFrame>
    </GuestAccessibilityProvider>
  );
}
