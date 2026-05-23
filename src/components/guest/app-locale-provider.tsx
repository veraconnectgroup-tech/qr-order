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
import { resolveLocaleChoice } from "@/lib/i18n/locale-config";
import {
  localizedDescription,
  localizedName,
} from "@/lib/i18n/menu-locale";
import { t, type Locale, type TranslationKey } from "@/lib/i18n/translations";

type AppLocaleContextValue = {
  locale: Locale;
  availableLocales: Locale[];
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
  availableLocales = [defaultLocale],
  children,
}: {
  slug: string;
  token: string;
  defaultLocale?: Locale;
  availableLocales?: Locale[];
  children: React.ReactNode;
}) {
  const locales = useMemo(() => {
    const unique = [...new Set(availableLocales)];
    return unique.length > 0 ? unique : [defaultLocale];
  }, [availableLocales, defaultLocale]);

  const [locale, setLocaleState] = useState<Locale>(() =>
    resolveLocaleChoice(null, locales, defaultLocale)
  );

  useEffect(() => {
    const saved = localStorage.getItem(storageKey(slug, token));
    const parsed = parseLocale(saved);
    if (parsed && locales.includes(parsed)) {
      setLocaleState(parsed);
      return;
    }
    setLocaleState(detectLocale(defaultLocale, locales));
  }, [slug, token, defaultLocale, locales]);

  const setLocale = useCallback(
    (next: Locale) => {
      if (!locales.includes(next)) return;
      setLocaleState(next);
      localStorage.setItem(storageKey(slug, token), next);
      persistLocaleOverride(next);
    },
    [slug, token, locales]
  );

  const value = useMemo(
    () => ({
      locale,
      availableLocales: locales,
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
    [locale, locales, setLocale]
  );

  return (
    <AppLocaleContext.Provider value={value}>{children}</AppLocaleContext.Provider>
  );
}

/** @deprecated Use AppLocaleProvider */
export const MenuLocaleProvider = AppLocaleProvider;

const fallback: AppLocaleContextValue = {
  locale: "de",
  availableLocales: ["de"],
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
