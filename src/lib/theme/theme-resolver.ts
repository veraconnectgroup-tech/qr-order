import {
  adjustHexBrightness,
  hexWithAlpha,
  normalizeHexColor,
} from "@/lib/theme/color-utils";
import { DEFAULT_THEME, type ResolvedTheme, type ThemeConfig } from "@/lib/theme/types";

export function buildThemeCssVars(input: {
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  highContrast?: boolean;
}): Record<string, string> {
  const primary = normalizeHexColor(input.primaryColor, DEFAULT_THEME.primaryColor);
  const secondary = normalizeHexColor(
    input.secondaryColor,
    adjustHexBrightness(primary, -12)
  );
  const emberHover = input.highContrast
    ? adjustHexBrightness(primary, 18)
    : adjustHexBrightness(primary, 8);
  const emberMuted = hexWithAlpha(primary, input.highContrast ? 0.28 : 0.18);

  return {
    "--qr-ember": primary,
    "--qr-ember-hover": emberHover,
    "--qr-ember-muted": emberMuted,
    "--qr-accent-secondary": secondary,
    "--guest-accent": primary,
    "--guest-accent-hover": emberHover,
    "--dash-accent": primary,
    "--dash-accent-hover": emberHover,
    "--dash-accent-muted": emberMuted,
    "--theme-font-family": input.fontFamily,
  };
}

export function buildThemeCssVarBlock(vars: Record<string, string>): string {
  return Object.entries(vars)
    .map(([key, value]) => `${key}:${value}`)
    .join(";");
}

export type ResolveThemeInput = {
  orgName: string;
  logoUrl?: string | null;
  displayName?: string | null;
  theme?: ThemeConfig | null;
  brandPrimaryColor?: string | null;
};

export function resolveTheme(input: ResolveThemeInput): ResolvedTheme {
  const theme = input.theme ?? {};
  const primaryColor = normalizeHexColor(
    theme.primaryColor ?? input.brandPrimaryColor,
    DEFAULT_THEME.primaryColor
  );
  const secondaryColor = normalizeHexColor(
    theme.secondaryColor,
    adjustHexBrightness(primaryColor, -12)
  );
  const fontFamily = theme.fontFamily?.trim() || DEFAULT_THEME.fontFamily;
  const colorScheme = theme.colorScheme ?? DEFAULT_THEME.colorScheme;
  const displayName = input.displayName?.trim() || DEFAULT_THEME.displayName;
  const cssVars = buildThemeCssVars({
    primaryColor,
    secondaryColor,
    fontFamily,
  });

  return {
    orgName: input.orgName,
    logoUrl: input.logoUrl ?? null,
    displayName,
    productSubline: DEFAULT_THEME.productSubline,
    primaryColor,
    secondaryColor,
    fontFamily,
    colorScheme,
    hidePoweredBy: theme.hidePoweredBy ?? false,
    poweredByLabel: theme.poweredByLabel?.trim() || DEFAULT_THEME.poweredByLabel,
    receiptFooter: theme.receiptFooter?.trim() || DEFAULT_THEME.receiptFooter,
    customGreeting: theme.customGreeting?.trim() || null,
    cssVars,
    cssVarStyle: buildThemeCssVarBlock(cssVars),
  };
}

export function replaceConciergeDisplayName(
  text: string,
  displayName: string,
  defaultName = DEFAULT_THEME.displayName
): string {
  if (!text || displayName === defaultName) return text;
  return text
    .replaceAll(defaultName, displayName)
    .replaceAll(defaultName.toLowerCase(), displayName)
    .replaceAll(defaultName.toUpperCase(), displayName);
}

export function themeColorSchemeAttribute(
  scheme: ResolvedTheme["colorScheme"]
): "dark" | "light" | undefined {
  if (scheme === "auto") return undefined;
  return scheme;
}

export function themeMetaColor(theme: ResolvedTheme): string {
  return theme.primaryColor;
}
