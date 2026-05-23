"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { LanguageSplash } from "@/components/guest/language-splash";
import {
  persistGuestLangChoice,
  readGuestLangChoice,
} from "@/lib/i18n/locale-config";
import {
  localizedDescription,
  localizedName,
} from "@/lib/i18n/menu-locale";
import { t, type MenuLocale, type TranslationKey } from "@/lib/i18n/translations";

type AppLocaleContextValue = {
  menuLocale: MenuLocale;
  isEnglish: boolean;
  setIsEnglish: (english: boolean) => void;
  tUI: (
    key: TranslationKey | string,
    vars?: Record<string, string | number>
  ) => string;
  tName: (item: { name: string; name_en?: string | null }) => string;
  tDescription: (item: {
    description?: string | null;
    description_en?: string | null;
  }) => string | null;
};

const AppLocaleContext = createContext<AppLocaleContextValue | null>(null);

export function AppLocaleProvider({
  locationId,
  menuLocale,
  orgName,
  logoUrl,
  children,
}: {
  locationId: string;
  menuLocale: MenuLocale;
  orgName: string;
  logoUrl?: string | null;
  children: React.ReactNode;
}) {
  const [ready, setReady] = useState(false);
  const [showSplash, setShowSplash] = useState(false);
  const [isEnglish, setIsEnglishState] = useState(false);

  useEffect(() => {
    const saved = readGuestLangChoice(locationId);
    if (saved === null) {
      setShowSplash(true);
      setIsEnglishState(false);
    } else {
      setIsEnglishState(saved === "en");
      setShowSplash(false);
    }
    setReady(true);
  }, [locationId]);

  const setIsEnglish = useCallback(
    (english: boolean) => {
      setIsEnglishState(english);
      persistGuestLangChoice(locationId, menuLocale, english);
      setShowSplash(false);
    },
    [locationId, menuLocale]
  );

  const value = useMemo(
    () => ({
      menuLocale,
      isEnglish,
      setIsEnglish,
      tUI: (key: TranslationKey | string, vars?: Record<string, string | number>) =>
        t(key, menuLocale, isEnglish, vars),
      tName: (item: { name: string; name_en?: string | null }) =>
        localizedName(item, isEnglish),
      tDescription: (item: {
        description?: string | null;
        description_en?: string | null;
      }) => localizedDescription(item, isEnglish),
    }),
    [menuLocale, isEnglish, setIsEnglish]
  );

  if (!ready) {
    return (
      <div className="min-h-dvh bg-[var(--guest-bg,#0a0a0a)]" aria-hidden />
    );
  }

  return (
    <AppLocaleContext.Provider value={value}>
      {showSplash ? (
        <LanguageSplash
          menuLocale={menuLocale}
          orgName={orgName}
          logoUrl={logoUrl}
          onChoose={(english) => setIsEnglish(english)}
        />
      ) : (
        children
      )}
    </AppLocaleContext.Provider>
  );
}

/** @deprecated Use AppLocaleProvider */
export const MenuLocaleProvider = AppLocaleProvider;

const fallback: AppLocaleContextValue = {
  menuLocale: "de",
  isEnglish: false,
  setIsEnglish: () => {},
  tUI: (key, vars) => t(key, "de", false, vars),
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
