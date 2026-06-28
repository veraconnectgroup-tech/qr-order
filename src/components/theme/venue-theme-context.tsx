"use client";

import { createContext, useContext, useMemo } from "react";
import type { ResolvedTheme } from "@/lib/theme/types";
import { replaceConciergeDisplayName } from "@/lib/theme/theme-resolver";

type VenueThemeContextValue = {
  theme: ResolvedTheme;
  displayName: string;
  labelText: (text: string) => string;
};

const VenueThemeContext = createContext<VenueThemeContextValue | null>(null);

export function VenueThemeProvider({
  theme,
  children,
}: {
  theme: ResolvedTheme;
  children: React.ReactNode;
}) {
  const value = useMemo(
    () => ({
      theme,
      displayName: theme.displayName,
      labelText: (text: string) =>
        replaceConciergeDisplayName(text, theme.displayName),
    }),
    [theme]
  );

  return (
    <VenueThemeContext.Provider value={value}>
      {children}
    </VenueThemeContext.Provider>
  );
}

export function useVenueTheme(): VenueThemeContextValue {
  const ctx = useContext(VenueThemeContext);
  if (!ctx) {
    throw new Error("useVenueTheme must be used within VenueThemeProvider");
  }
  return ctx;
}

export function useVenueThemeOptional(): VenueThemeContextValue | null {
  return useContext(VenueThemeContext);
}
