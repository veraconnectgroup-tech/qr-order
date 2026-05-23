"use client";

import { Sparkles } from "lucide-react";
import { useAppLocale } from "@/components/guest/app-locale-provider";

export function AiConciergeIntro({ onOpen }: { onOpen: () => void }) {
  const { tUI } = useAppLocale();

  return (
    <button
      type="button"
      onClick={onOpen}
      className="mx-4 mb-3 flex w-[calc(100%-2rem)] items-center gap-3 rounded-2xl border border-orange-500/30 bg-gradient-to-r from-orange-500/15 via-zinc-900 to-zinc-900 px-4 py-3 text-left transition active:scale-[0.99] hover:border-orange-500/50"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-orange-500/20 text-orange-400">
        <Sparkles className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-zinc-100">
          {tUI("ai.intro.title")}
        </span>
        <span className="mt-0.5 block text-xs text-zinc-400">
          {tUI("ai.intro.subtitle")}
        </span>
      </span>
    </button>
  );
}
