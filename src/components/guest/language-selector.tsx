"use client";

import { ChevronDown } from "lucide-react";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LOCALE_META, type Locale } from "@/lib/i18n/translations";
import { cn } from "@/lib/utils";

export function LanguageSelector({ compact = false }: { compact?: boolean }) {
  const { locale, availableLocales, setLocale } = useAppLocale();

  if (availableLocales.length <= 1) {
    return null;
  }

  const currentLabel = LOCALE_META[locale].label;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full border border-zinc-700 bg-zinc-900 text-zinc-200 transition touch-manipulation hover:border-zinc-600 hover:text-zinc-50",
            compact ? "px-2.5 py-1 text-xs font-medium" : "px-3 py-1.5 text-sm font-medium"
          )}
          aria-label={`Language: ${currentLabel}`}
        >
          <span>{currentLabel}</span>
          <ChevronDown className={compact ? "size-3 opacity-60" : "size-3.5 opacity-60"} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[10rem] border-zinc-800 bg-zinc-950 text-zinc-100"
      >
        {availableLocales.map((code) => {
          const active = locale === code;
          return (
            <DropdownMenuItem
              key={code}
              onClick={() => setLocale(code as Locale)}
              className={cn(
                "cursor-pointer text-sm",
                active && "bg-orange-500/15 text-orange-300 focus:bg-orange-500/15 focus:text-orange-300"
              )}
            >
              {LOCALE_META[code].label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
