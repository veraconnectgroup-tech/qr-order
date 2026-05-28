"use client";

import type { Scene } from "@/lib/scene/types";
import { sceneChipsLayer, sceneInlineLayers } from "@/lib/scene/layer-utils";
import { cn } from "@/lib/utils";
import { DenisScenePresence } from "@/components/guest/denis-scene-presence";
import { DenisSceneChips } from "@/components/guest/denis-scene-chips";
import { DenisSceneInlineRecommendations } from "@/components/guest/denis-scene-inline";

/**
 * Unified Denis surface on the menu — concierge rail, not a chat entry card.
 * @see docs/architecture/ADR-017-denis-scene-first-presentation.md
 */
export function DenisSceneShell({
  scene,
  currency,
  subtitle,
  onOpenDesk,
  onChipPress,
  onInlineAdd,
  className,
}: {
  scene: Scene;
  currency: string;
  subtitle?: string | null;
  onOpenDesk: () => void;
  onChipPress: (chipId: string, label: string) => void;
  onInlineAdd: (productId: string) => void;
  className?: string;
}) {
  const chipsLayer = sceneChipsLayer(scene);
  const inlineLayers = sceneInlineLayers(scene);
  const isThinking = scene.chrome.markState === "think";

  return (
    <section
      className={cn(
        "denis-scene-shell relative z-30 mx-4 mb-3 overflow-hidden rounded-2xl border border-[var(--qr-elevated)] bg-[var(--qr-surface)] shadow-[0_0_40px_rgba(232,93,4,0.06)]",
        isThinking && "denis-scene-shell--think",
        className
      )}
      aria-label="Denis"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-[var(--qr-ember)]"
        aria-hidden
      />

      <DenisScenePresence
        scene={scene}
        subtitle={subtitle}
        onOpenDesk={onOpenDesk}
        compact
      />

      {chipsLayer?.options.length ? (
        <div className="border-t border-[var(--qr-elevated)]/80 px-3 pb-3 pt-2">
          <DenisSceneChips scene={scene} onChipPress={onChipPress} />
        </div>
      ) : null}

      {inlineLayers.length ? (
        <div className="border-t border-[var(--qr-elevated)]/80">
          <DenisSceneInlineRecommendations
            scene={scene}
            currency={currency}
            onAdd={onInlineAdd}
            embedded
          />
        </div>
      ) : null}
    </section>
  );
}
