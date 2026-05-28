"use client";

import { ChevronRight } from "lucide-react";
import { DenisMarkBadge } from "@/components/design-system/denis-mark-badge";
import { useAppLocale } from "@/components/guest/app-locale-provider";

/** Fallback before guest_scene loads — same rail grammar as DenisSceneShell. */
export function AiConciergeIntro({
  onOpen,
  subtitle,
  tableName,
  venueName,
}: {
  onOpen: () => void;
  subtitle?: string;
  tableName?: string;
  venueName?: string;
}) {
  const { tUI } = useAppLocale();

  return (
    <section className="denis-scene-shell relative mx-4 mb-3 overflow-hidden rounded-2xl border border-[var(--qr-elevated)] bg-[var(--qr-surface)] shadow-[0_0_40px_rgba(232,93,4,0.06)]">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-[var(--qr-ember)]"
        aria-hidden
      />
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition active:opacity-90"
      >
        <DenisMarkBadge size="md" markState="idle" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <p className="text-sm font-semibold tracking-tight text-[var(--qr-ivory)]">
              {tUI("ai.intro.title")}
            </p>
            {tableName && venueName ? (
              <span className="text-[11px] text-[var(--qr-muted)]">
                {tableName} · {venueName}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-[13px] leading-snug text-[var(--qr-muted)]">
            {subtitle ?? tUI("ai.intro.subtitle")}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-0.5 text-[11px] font-medium uppercase tracking-wide text-[var(--qr-ember)]">
          {tUI("scene.askDenisShort")}
          <ChevronRight className="size-3.5" />
        </span>
      </button>
    </section>
  );
}
