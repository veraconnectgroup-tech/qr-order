"use client";

import { useMemo } from "react";
import type { CSSProperties } from "react";
import type { ResolvedTheme } from "@/lib/theme/types";
import { buildThemeCssVars } from "@/lib/theme/theme-resolver";

export function buildGuestThemeStyleBlock(
  theme: ResolvedTheme,
  highContrast = false
): string {
  const cssVars = buildThemeCssVars({
    primaryColor: theme.primaryColor,
    secondaryColor: theme.secondaryColor,
    fontFamily: theme.fontFamily,
    highContrast,
  });

  const varBlock = Object.entries(cssVars)
    .map(([key, value]) => `${key}:${value}`)
    .join(";");

  const lightVars =
    "color-scheme:light;--qr-void:#fafafa;--qr-surface:#ffffff;background:#fafafa;color:#171717;";

  let block = `.guest-theme{${varBlock};font-family:var(--theme-font-family);}`;
  if (theme.colorScheme === "light") {
    block += `.guest-theme{${lightVars}}`;
  } else if (theme.colorScheme === "auto") {
    block += `@media (prefers-color-scheme:light){.guest-theme{${lightVars}}}`;
  }
  return block;
}

export function DashboardThemeStyle({
  cssVars,
  fontFamily,
}: {
  cssVars: Record<string, string>;
  fontFamily: string;
}) {
  const style = { ...cssVars, fontFamily } as CSSProperties;
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `.dashboard-theme{${Object.entries(style)
          .map(([key, value]) => `${key}:${String(value)}`)
          .join(";")}}`,
      }}
    />
  );
}
