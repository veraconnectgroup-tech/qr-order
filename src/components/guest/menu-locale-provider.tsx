"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { MenuLocale } from "@/lib/i18n/menu-locale";
import {
  localizedDescription,
  localizedName,
} from "@/lib/i18n/menu-locale";

type MenuLocaleContextValue = {
  locale: MenuLocale;
  setLocale: (locale: MenuLocale) => void;
  toggleEnglish: () => void;
  tName: (item: { name: string; name_en?: string | null }) => string;
  tDescription: (item: {
    description?: string | null;
    description_en?: string | null;
  }) => string | null;
};

const MenuLocaleContext = createContext<MenuLocaleContextValue | null>(null);

function storageKey(slug: string, token: string) {
  return `menu-locale:${slug}:${token}`;
}

export function MenuLocaleProvider({
  slug,
  token,
  children,
}: {
  slug: string;
  token: string;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<MenuLocale>("default");

  useEffect(() => {
    const saved = localStorage.getItem(storageKey(slug, token));
    if (saved === "en" || saved === "default") {
      setLocaleState(saved);
      return;
    }
    if (typeof navigator !== "undefined" && navigator.language.startsWith("en")) {
      setLocaleState("en");
    }
  }, [slug, token]);

  const setLocale = useCallback(
    (next: MenuLocale) => {
      setLocaleState(next);
      localStorage.setItem(storageKey(slug, token), next);
    },
    [slug, token]
  );

  const toggleEnglish = useCallback(() => {
    setLocale(locale === "en" ? "default" : "en");
  }, [locale, setLocale]);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      toggleEnglish,
      tName: (item: { name: string; name_en?: string | null }) =>
        localizedName(item, locale),
      tDescription: (item: {
        description?: string | null;
        description_en?: string | null;
      }) => localizedDescription(item, locale),
    }),
    [locale, setLocale, toggleEnglish]
  );

  return (
    <MenuLocaleContext.Provider value={value}>
      {children}
    </MenuLocaleContext.Provider>
  );
}

export function useMenuLocale() {
  const ctx = useContext(MenuLocaleContext);
  if (!ctx) {
    return {
      locale: "default" as MenuLocale,
      setLocale: () => {},
      toggleEnglish: () => {},
      tName: (item: { name: string; name_en?: string | null }) => item.name,
      tDescription: (item: {
        description?: string | null;
        description_en?: string | null;
      }) => item.description ?? null,
    };
  }
  return ctx;
}
