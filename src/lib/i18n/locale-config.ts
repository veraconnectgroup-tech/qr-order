import type { Locale, MenuLocale } from "@/lib/i18n/translations";

export type TextDirection = "ltr" | "rtl";

export const LOCALE_DIR: Record<Locale, TextDirection> = {
  de: "ltr",
  en: "ltr",
  sr: "ltr",
  tr: "ltr",
  hr: "ltr",
  fr: "ltr",
  es: "ltr",
  it: "ltr",
  ru: "ltr",
  ar: "rtl",
};

export function getLocaleDir(
  menuLocale: MenuLocale,
  isEnglish: boolean
): TextDirection {
  return LOCALE_DIR[isEnglish ? "en" : menuLocale];
}

export const MENU_LOCALES: MenuLocale[] = [
  "de",
  "sr",
  "tr",
  "hr",
  "fr",
  "es",
  "it",
  "ru",
  "ar",
];

export function isLocale(value: string): value is Locale {
  return value === "en" || isMenuLocale(value);
}

export function isMenuLocale(value: string): value is MenuLocale {
  return (MENU_LOCALES as readonly string[]).includes(value);
}

export function parseMenuLocale(value: string | null | undefined): MenuLocale {
  if (value && isMenuLocale(value)) return value;
  return "de";
}

export function guestLangStorageKey(locationId: string) {
  return `qr_lang_${locationId}`;
}

export function readGuestLangChoice(
  locationId: string
): "en" | MenuLocale | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(guestLangStorageKey(locationId));
  if (!raw) return null;
  if (raw === "en") return "en";
  if (isMenuLocale(raw)) return raw;
  return null;
}

export function persistGuestLangChoice(
  locationId: string,
  menuLocale: MenuLocale,
  isEnglish: boolean
) {
  localStorage.setItem(
    guestLangStorageKey(locationId),
    isEnglish ? "en" : menuLocale
  );
}
