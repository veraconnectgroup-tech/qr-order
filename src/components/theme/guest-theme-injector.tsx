"use client";

import { useEffect, useMemo } from "react";
import { useGuestAccessibility } from "@/components/guest/guest-accessibility-provider";
import { buildGuestThemeStyleBlock } from "@/components/theme/venue-theme-provider";
import type { ResolvedTheme } from "@/lib/theme/types";

/** Injects per-venue CSS variables into the guest shell (works from nested layouts). */
export function GuestThemeInjector({ theme }: { theme: ResolvedTheme }) {
  const { prefs } = useGuestAccessibility();
  const themeBlock = useMemo(
    () => buildGuestThemeStyleBlock(theme, prefs.highContrast),
    [theme, prefs.highContrast]
  );

  useEffect(() => {
    const shell = document.querySelector(".guest-theme");
    if (!shell) return;
    shell.setAttribute("data-color-scheme", theme.colorScheme);
  }, [theme.colorScheme]);

  return (
    <style
      data-venue-theme={theme.primaryColor}
      dangerouslySetInnerHTML={{ __html: themeBlock }}
    />
  );
}
