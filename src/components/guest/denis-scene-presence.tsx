"use client";

import { DenisBrandMark } from "@/components/design-system/denis-brand-mark";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import { DenisScenePhaseStrip } from "@/components/guest/denis-scene-phase-strip";
import type { Scene } from "@/lib/scene/types";

export function DenisScenePresence({
  scene,
  subtitle,
  onOpenDesk,
}: {
  scene: Scene;
  subtitle?: string | null;
  onOpenDesk: () => void;
}) {
  const { tUI } = useAppLocale();
  const lead = subtitle ?? tUI("ai.intro.subtitle");

  return (
    <div className="relative mx-4 mb-2 w-[calc(100%-2rem)] overflow-hidden rounded-xl border border-[var(--qr-elevated)] bg-[var(--qr-surface)] p-4 text-left before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-[var(--qr-ember)] before:content-['']">
      <div className="flex items-start gap-3">
        <DenisBrandMark
          markSize={24}
          markState={
            scene.chrome.markState === "listen"
              ? "listen"
              : scene.chrome.markState === "think"
                ? "think"
                : "idle"
          }
          className="[&_.text-dash-text-muted]:text-[var(--qr-muted)] [&_.text-dash-text]:text-[var(--qr-ivory)]"
        />
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--qr-muted)]">
            {scene.chrome.tableName} · {scene.chrome.venueName}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--qr-muted)]">{lead}</p>
          <DenisScenePhaseStrip scene={scene} />
        </div>
      </div>
      <button
        type="button"
        onClick={onOpenDesk}
        className="mt-3 w-full rounded-full border border-[var(--qr-ember)]/30 bg-[var(--qr-ember-muted)] px-4 py-2.5 text-sm font-medium text-[var(--qr-ivory)] transition active:scale-[0.99] hover:border-[var(--qr-ember)]/50"
      >
        {tUI("scene.openDesk")}
      </button>
    </div>
  );
}
