"use client";

import { useAppLocale } from "@/components/guest/app-locale-provider";
import type { Scene, SessionPhase } from "@/lib/scene/types";

const PHASE_KEYS: Record<SessionPhase, string> = {
  latent: "scene.phase.latent",
  browsing: "scene.phase.browsing",
  ordering: "scene.phase.ordering",
  waiting: "scene.phase.waiting",
  settling: "scene.phase.settling",
  closed: "scene.phase.closed",
};

export function DenisScenePhaseStrip({ scene }: { scene: Scene }) {
  const { tUI } = useAppLocale();
  const key = PHASE_KEYS[scene.phase];

  return (
    <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--qr-ember)]/85">
      {tUI(key as "scene.phase.browsing")}
    </p>
  );
}
