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

/**
 * Pinned to English only, on purpose: only copyEn has the current hero/
 * feature copy (see the hero headline + station-voice feature row
 * commits) — copyDe/copySr are stale. Removing LandingLocaleSwitcher
 * from the nav (2ab576fc) didn't actually stop a visitor from landing
 * on the stale translations anyway, since this function still
 * auto-detected from navigator.language/localStorage/?lang= with no
 * switcher left to get back to English — a real regression, not the
 * intended fix. Re-enable auto-detect + the switcher once DE/SR copy is
 * caught up to match EN.
 */
function readInitialLocale(): LandingLocale {
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
              ? "rounded-full bg-black/[0.08] px-2.5 py-1 text-[11px] font-semibold uppercase text-[var(--lp-ink)]"
              : "rounded-full px-2.5 py-1 text-[11px] font-medium uppercase text-[var(--lp-subtle)] hover:text-[var(--lp-ink)]"
          }
        >
          {code}
        </button>
      ))}
    </div>
  );
}
