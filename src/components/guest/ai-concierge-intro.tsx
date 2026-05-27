"use client";

import { DenisTableMark } from "@/components/design-system/denis-table-mark";
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
      className="group mx-4 mb-3 flex w-[calc(100%-2rem)] items-center gap-3 rounded-xl border border-[var(--qr-elevated)] bg-[var(--qr-surface)] px-4 py-3 text-start transition hover:border-[var(--qr-ember)]/30 active:scale-[0.99]"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--qr-elevated)]">
        <DenisTableMark size={24} state="idle" className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-[var(--qr-ivory)]">
          {tUI("ai.intro.title")}
        </span>
        <span className="mt-0.5 block text-xs text-[var(--qr-muted)]">
          {subtitle ?? tUI("ai.intro.subtitle")}
        </span>
      </span>
    </button>
  );
}
