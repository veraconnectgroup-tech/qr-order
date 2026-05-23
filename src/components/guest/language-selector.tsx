"use client";

import { useAppLocale } from "@/components/guest/app-locale-provider";
import { LOCALE_LABELS, LOCALES, type Locale } from "@/lib/i18n/translations";
import { cn } from "@/lib/utils";

export function LanguageSelector({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useAppLocale();

  if (compact) {
    return (
      <div className="flex shrink-0 gap-1">
        {LOCALES.map((code) => {
          const { flag, label } = LOCALE_LABELS[code];
          const active = locale === code;
          return (
            <button
              key={code}
              type="button"
              onClick={() => setLocale(code)}
              className={cn(
                "rounded-full border px-2 py-1 text-[10px] font-semibold transition touch-manipulation",
                active
                  ? "border-orange-500/50 bg-orange-500/15 text-orange-300"
                  : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:text-zinc-200"
              )}
              aria-pressed={active}
              aria-label={label}
            >
              {flag}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex shrink-0 flex-wrap gap-1">
      {LOCALES.map((code) => {
        const { flag, label } = LOCALE_LABELS[code];
        const active = locale === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLocale(code as Locale)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition touch-manipulation",
              active
                ? "border-orange-500/50 bg-orange-500/15 text-orange-300"
                : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            )}
            aria-pressed={active}
          >
            {flag} {label}
          </button>
        );
      })}
    </div>
  );
}
