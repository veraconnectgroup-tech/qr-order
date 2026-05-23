"use client";

import { MessageCircle, Sparkles } from "lucide-react";
import { useAppLocale } from "@/components/guest/app-locale-provider";

export function AiConciergeIntro({
  onOpen,
  subtitle,
}: {
  onOpen: () => void;
  subtitle?: string;
}) {
  const { tUI } = useAppLocale();

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group mx-4 mb-3 flex w-[calc(100%-2rem)] items-center gap-3 rounded-2xl border border-orange-500/30 bg-gradient-to-r from-orange-500/15 via-zinc-900 to-zinc-900 px-4 py-3 text-start transition active:scale-[0.99] hover:border-orange-500/50"
    >
      <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-orange-500/20 text-orange-400">
        <span className="absolute inset-0 animate-pulse rounded-full bg-orange-500/10" />
        <Sparkles className="relative size-5 animate-pulse" />
        <MessageCircle className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full bg-zinc-950 text-orange-300" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-zinc-100">
          {tUI("ai.intro.title")}
        </span>
        <span className="mt-0.5 block text-xs text-zinc-400">
          {subtitle ?? tUI("ai.intro.subtitle")}
        </span>
      </span>
    </button>
  );
}
