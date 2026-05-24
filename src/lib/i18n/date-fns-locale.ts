import type { Locale } from "date-fns";
import { ar, de, enUS, es, fr, hr, it, ru, tr } from "date-fns/locale";
import type { MenuLocale } from "@/lib/i18n/translations";

const MAP: Record<MenuLocale, Locale> = {
  de,
  sr: hr,
  hr,
  tr,
  ar,
  es,
  fr,
  it,
  ru,
};

export function dateFnsLocaleForMenu(menuLocale: MenuLocale): Locale {
  return MAP[menuLocale] ?? de;
}

export function dateFnsLocaleOrEnglish(
  menuLocale: MenuLocale,
  preferEnglish: boolean
): Locale {
  if (preferEnglish) return enUS;
  return dateFnsLocaleForMenu(menuLocale);
}
