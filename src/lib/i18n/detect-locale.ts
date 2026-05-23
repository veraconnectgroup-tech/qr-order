import type { Locale } from "@/lib/i18n/translations";
import { LOCALES } from "@/lib/i18n/translations";

export function parseLocale(value: string | null | undefined): Locale | null {
  if (value && (LOCALES as readonly string[]).includes(value)) {
    return value as Locale;
  }
  return null;
}

export function detectLocale(defaultLocale: Locale = "de"): Locale {
  if (typeof window === "undefined") {
    return defaultLocale;
  }

  const override = localStorage.getItem("guest-locale-override");
  const parsedOverride = parseLocale(override);
  if (parsedOverride) return parsedOverride;

  const lang = navigator.language.toLowerCase();
  if (lang.startsWith("en")) return "en";
  if (lang.startsWith("sr")) return "sr";
  if (lang.startsWith("hr")) return "hr";
  if (lang.startsWith("tr")) return "tr";
  if (lang.startsWith("de")) return "de";

  return defaultLocale;
}

export function persistLocaleOverride(locale: Locale) {
  localStorage.setItem("guest-locale-override", locale);
}
