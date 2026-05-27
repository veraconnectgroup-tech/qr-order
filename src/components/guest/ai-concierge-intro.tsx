"use client";

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
      className="mx-4 mb-4 flex w-[calc(100%-2rem)] flex-col items-start gap-1 px-1 py-2 text-start transition active:opacity-70"
    >
      <span className="text-sm font-medium text-[var(--qr-ivory)]">
        {tUI("ai.intro.title")}
      </span>
      <span className="text-sm leading-relaxed text-[var(--qr-muted)]">
        {subtitle ?? tUI("ai.intro.subtitle")}
      </span>
    </button>
  );
}
