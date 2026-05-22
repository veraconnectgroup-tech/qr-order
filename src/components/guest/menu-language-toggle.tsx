"use client";

import { useMenuLocale } from "@/components/guest/menu-locale-provider";
import { cn } from "@/lib/utils";

export function MenuLanguageToggle() {
  const { locale, toggleEnglish } = useMenuLocale();

  return (
    <button
      type="button"
      onClick={toggleEnglish}
      className={cn(
        "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition",
        locale === "en"
          ? "border-orange-500/50 bg-orange-500/15 text-orange-300"
          : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:text-zinc-200"
      )}
      aria-pressed={locale === "en"}
    >
      EN
    </button>
  );
}
