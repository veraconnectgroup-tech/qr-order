"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  landingCopy,
  resolveLandingLocale,
  type LandingCopy,
  type LandingLocale,
  LANDING_LOCALES,
} from "@/lib/landing/landing-copy";

type LandingLocaleContextValue = {
  locale: LandingLocale;
  setLocale: (locale: LandingLocale) => void;
  copy: LandingCopy;
};

const LandingLocaleContext = createContext<LandingLocaleContextValue | null>(
  null
);

const STORAGE_KEY = "denis:landing-locale";

function readInitialLocale(): LandingLocale {
  if (typeof window === "undefined") return "en";
  try {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("lang");
    if (fromQuery) return resolveLandingLocale(fromQuery);
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) return resolveLandingLocale(stored);
  } catch {
    /* ignore */
  }
  if (typeof navigator !== "undefined") {
    return resolveLandingLocale(navigator.language);
  }
  return "en";
}

export function LandingLocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<LandingLocale>("en");

  useEffect(() => {
    setLocaleState(readInitialLocale());
  }, []);

  const setLocale = useCallback((next: LandingLocale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
      document.documentElement.lang = next === "sr" ? "sr" : next;
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      copy: landingCopy(locale),
    }),
    [locale, setLocale]
  );

  return (
    <LandingLocaleContext.Provider value={value}>
      {children}
    </LandingLocaleContext.Provider>
  );
}

export function useLandingCopy() {
  const ctx = useContext(LandingLocaleContext);
  if (!ctx) {
    throw new Error("useLandingCopy must be used within LandingLocaleProvider");
  }
  return ctx;
}

export function LandingLocaleSwitcher({ className }: { className?: string }) {
  const { locale, setLocale } = useLandingCopy();

  return (
    <div className={className} role="group" aria-label="Language">
      {LANDING_LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLocale(code)}
          className={
            locale === code
              ? "rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase text-white"
              : "rounded-full px-2.5 py-1 text-[11px] font-medium uppercase text-zinc-500 hover:text-zinc-300"
          }
        >
          {code}
        </button>
      ))}
    </div>
  );
}
