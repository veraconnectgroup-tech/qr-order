import type { Locale } from "@/lib/i18n/translations";
import { isLocale, resolveLocaleChoice } from "@/lib/i18n/locale-config";

export function parseLocale(value: string | null | undefined): Locale | null {
  if (value && isLocale(value)) {
    return value;
  }
  return null;
}

export function detectLocale(
  defaultLocale: Locale,
  availableLocales: Locale[]
): Locale {
  if (typeof window === "undefined") {
    return resolveLocaleChoice(null, availableLocales, defaultLocale);
  }

  const saved = localStorage.getItem("guest-locale-override");
  const parsedSaved = parseLocale(saved);
  if (parsedSaved && availableLocales.includes(parsedSaved)) {
    return parsedSaved;
  }

  const lang = navigator.language.toLowerCase();
  const browserCandidates: Locale[] = [];

  if (lang.startsWith("en")) browserCandidates.push("en");
  if (lang.startsWith("sr")) browserCandidates.push("sr");
  if (lang.startsWith("hr")) browserCandidates.push("hr");
  if (lang.startsWith("tr")) browserCandidates.push("tr");
  if (lang.startsWith("de")) browserCandidates.push("de");
  if (lang.startsWith("ar")) browserCandidates.push("ar");
  if (lang.startsWith("fr")) browserCandidates.push("fr");
  if (lang.startsWith("es")) browserCandidates.push("es");
  if (lang.startsWith("it")) browserCandidates.push("it");
  if (lang.startsWith("ru")) browserCandidates.push("ru");

  for (const candidate of browserCandidates) {
    if (availableLocales.includes(candidate)) {
      return candidate;
    }
  }

  return resolveLocaleChoice(null, availableLocales, defaultLocale);
}

export function persistLocaleOverride(locale: Locale) {
  localStorage.setItem("guest-locale-override", locale);
}
