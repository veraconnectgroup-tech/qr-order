import type { Locale } from "@/lib/i18n/translations";

export const ALL_LOCALES: Locale[] = [
  "de",
  "en",
  "sr",
  "tr",
  "hr",
  "ar",
  "fr",
  "es",
  "it",
  "ru",
];

export function isLocale(value: string): value is Locale {
  return (ALL_LOCALES as readonly string[]).includes(value);
}

/** Parse DB text[] into ordered unique locales; always includes default. */
export function parseAvailableLocales(
  raw: string[] | null | undefined,
  defaultLocale: Locale
): Locale[] {
  const seen = new Set<Locale>();
  const result: Locale[] = [];

  for (const code of raw ?? []) {
    if (!isLocale(code) || seen.has(code)) continue;
    seen.add(code);
    result.push(code);
  }

  if (result.length === 0) {
    return [defaultLocale];
  }

  if (!seen.has(defaultLocale)) {
    return [defaultLocale, ...result];
  }

  return result;
}

export function resolveLocaleChoice(
  choice: string | null | undefined,
  availableLocales: Locale[],
  defaultLocale: Locale
): Locale {
  const parsed = choice && isLocale(choice) ? choice : null;
  if (parsed && availableLocales.includes(parsed)) {
    return parsed;
  }
  if (availableLocales.includes(defaultLocale)) {
    return defaultLocale;
  }
  return availableLocales[0] ?? defaultLocale;
}
