"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  detectLocale,
  parseLocale,
  persistLocaleOverride,
} from "@/lib/i18n/detect-locale";
import {
  localizedDescription,
  localizedName,
} from "@/lib/i18n/menu-locale";
import { t, type Locale, type TranslationKey } from "@/lib/i18n/translations";

type AppLocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  tUI: (key: TranslationKey | string, vars?: Record<string, string | number>) => string;
  tName: (item: { name: string; name_en?: string | null }) => string;
  tDescription: (item: {
    description?: string | null;
    description_en?: string | null;
  }) => string | null;
};

const AppLocaleContext = createContext<AppLocaleContextValue | null>(null);

function storageKey(slug: string, token: string) {
  return `guest-locale:${slug}:${token}`;
}

export function AppLocaleProvider({
  slug,
  token,
  defaultLocale = "de",
  children,
}: {
  slug: string;
  token: string;
  defaultLocale?: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey(slug, token));
    const parsed = parseLocale(saved);
    if (parsed) {
      setLocaleState(parsed);
      return;
    }
    setLocaleState(detectLocale(defaultLocale));
  }, [slug, token, defaultLocale]);

  const setLocale = useCallback(
    (next: Locale) => {
      setLocaleState(next);
      localStorage.setItem(storageKey(slug, token), next);
      persistLocaleOverride(next);
    },
    [slug, token]
  );

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      tUI: (key: TranslationKey | string, vars?: Record<string, string | number>) =>
        t(key, locale, vars),
      tName: (item: { name: string; name_en?: string | null }) =>
        localizedName(item, locale),
      tDescription: (item: {
        description?: string | null;
        description_en?: string | null;
      }) => localizedDescription(item, locale),
    }),
    [locale, setLocale]
  );

  return (
    <AppLocaleContext.Provider value={value}>{children}</AppLocaleContext.Provider>
  );
}

/** @deprecated Use AppLocaleProvider */
export const MenuLocaleProvider = AppLocaleProvider;

const fallback: AppLocaleContextValue = {
  locale: "de",
  setLocale: () => {},
  tUI: (key, vars) => t(key, "de", vars),
  tName: (item) => item.name,
  tDescription: (item) => item.description ?? null,
};

export function useAppLocale() {
  const ctx = useContext(AppLocaleContext);
  return ctx ?? fallback;
}

/** @deprecated Use useAppLocale */
export function useMenuLocale() {
  return useAppLocale();
}
