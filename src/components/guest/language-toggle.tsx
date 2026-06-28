"use client";

import { useAppLocale } from "@/components/guest/app-locale-provider";
import { LOCALE_SHORT } from "@/lib/i18n/translations";
import { cn } from "@/lib/utils";

export function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { menuLocale, isEnglish, setIsEnglish, tUI } = useAppLocale();
  const primaryShort = LOCALE_SHORT[menuLocale];

  return (
    <div
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border border-zinc-700 bg-zinc-900 p-0.5 text-zinc-300",
        compact ? "text-xs" : "text-sm"
      )}
      role="group"
      aria-label={tUI("a11y.language")}
    >
      <button
        type="button"
        onClick={() => setIsEnglish(false)}
        className={cn(
          "rounded-full px-2.5 py-1 font-semibold transition touch-manipulation",
          compact ? "min-h-7" : "min-h-8 px-3",
          !isEnglish
            ? "bg-orange-700 text-white"
            : "text-zinc-400 hover:text-zinc-200"
        )}
        aria-pressed={!isEnglish}
      >
        {primaryShort}
      </button>
      <span className="px-0.5 text-zinc-600">|</span>
      <button
        type="button"
        onClick={() => setIsEnglish(true)}
        className={cn(
          "rounded-full px-2.5 py-1 font-semibold transition touch-manipulation",
          compact ? "min-h-7" : "min-h-8 px-3",
          isEnglish
            ? "bg-orange-700 text-white"
            : "text-zinc-400 hover:text-zinc-200"
        )}
        aria-pressed={isEnglish}
      >
        EN
      </button>
    </div>
  );
}

/** @deprecated Use LanguageToggle */
export function LanguageSelector(props: { compact?: boolean }) {
  return <LanguageToggle {...props} />;
}
