import type { MenuLocale } from "@/lib/i18n/translations";
import { isMenuLocale, parseMenuLocale } from "@/lib/i18n/locale-config";

/** @deprecated Bilingual guest flow uses menu_locale + English only. */
export function parseLocale(value: string | null | undefined): MenuLocale | null {
  if (value && isMenuLocale(value)) return value;
  return null;
}

export function parseMenuLocaleFromDb(
  menuLocale: string | null | undefined,
  defaultLocale: string | null | undefined
): MenuLocale {
  return parseMenuLocale(menuLocale ?? defaultLocale ?? "de");
}
