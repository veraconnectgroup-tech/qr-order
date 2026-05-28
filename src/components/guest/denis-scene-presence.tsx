"use client";

import { ChevronRight } from "lucide-react";
import { DenisBrandMark } from "@/components/design-system/denis-brand-mark";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import { DenisScenePhaseStrip } from "@/components/guest/denis-scene-phase-strip";
import type { Scene } from "@/lib/scene/types";
import { cn } from "@/lib/utils";

export function DenisScenePresence({
  scene,
  subtitle,
  onOpenDesk,
  compact = false,
}: {
  scene: Scene;
  subtitle?: string | null;
  onOpenDesk: () => void;
  compact?: boolean;
}) {
  const { tUI } = useAppLocale();
  const lead = subtitle ?? tUI("ai.intro.subtitle");
  const markState =
    scene.chrome.markState === "listen"
      ? "listen"
      : scene.chrome.markState === "think"
        ? "think"
        : "idle";

  return (
    <div
      className={cn(
        "flex items-center gap-3",
        compact ? "px-3 py-2.5" : "px-4 py-3"
      )}
    >
      <DenisBrandMark markSize={24} markState={markState} markOnly />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <p className="text-sm font-semibold tracking-tight text-[var(--qr-ivory)]">
            Denis
          </p>
          <span className="text-[11px] text-[var(--qr-muted)]">
            {scene.chrome.tableName} · {scene.chrome.venueName}
          </span>
        </div>
        <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-[var(--qr-muted)]">
          {lead}
        </p>
        <DenisScenePhaseStrip scene={scene} />
      </div>

      <button
        type="button"
        onClick={onOpenDesk}
        className="group flex shrink-0 flex-col items-end gap-0.5 ps-2 text-end"
        aria-label={tUI("scene.askDenis")}
      >
        <span className="flex items-center gap-0.5 text-[11px] font-medium uppercase tracking-wide text-[var(--qr-ember)]">
          {tUI("scene.askDenisShort")}
          <ChevronRight className="size-3.5 transition group-active:translate-x-0.5" />
        </span>
      </button>
    </div>
  );
}
