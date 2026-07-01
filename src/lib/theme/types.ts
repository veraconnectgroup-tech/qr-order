export type ThemeColorScheme = "auto" | "dark" | "light";

export type ThemeConfig = {
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  colorScheme?: ThemeColorScheme;
  hidePoweredBy?: boolean;
  poweredByLabel?: string;
  receiptFooter?: string;
  customGreeting?: string;
};

export type ResolvedTheme = {
  orgName: string;
  logoUrl: string | null;
  /** White-label concierge display name (default Denis). */
  displayName: string;
  productSubline: string;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  colorScheme: ThemeColorScheme;
  hidePoweredBy: boolean;
  poweredByLabel: string;
  receiptFooter: string;
  customGreeting: string | null;
  cssVars: Record<string, string>;
  /** Serialized for client hydration. */
  cssVarStyle: string;
};

export const DEFAULT_THEME = {
  displayName: "Denis",
  productSubline: "Part of Vera Group",
  primaryColor: "#e85d04",
  secondaryColor: "#c2410c",
  fontFamily: "var(--font-sans, Inter, system-ui, sans-serif)",
  colorScheme: "dark" as ThemeColorScheme,
  hidePoweredBy: false,
  poweredByLabel: "Powered by Vera IT",
  receiptFooter: "Hvala što ste bili kod nas! ❤️",
};
