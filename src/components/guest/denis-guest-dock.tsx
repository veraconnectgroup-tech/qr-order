"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { DenisBrandMark } from "@/components/design-system/denis-brand-mark";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import { DenisSceneChips } from "@/components/guest/denis-scene-chips";
import { DenisSceneInlineRecommendations } from "@/components/guest/denis-scene-inline";
import { DenisSituationView } from "@/components/guest/denis-situation-view";
import type { Scene } from "@/lib/scene/types";
import { sceneChipsLayer, sceneInlineLayers } from "@/lib/scene/layer-utils";
import { cn } from "@/lib/utils";

const STATUS_KEYS: Record<string, string> = {
  pending: "order.status.pending",
  confirmed: "order.status.accepted",
  accepted: "order.status.accepted",
  preparing: "order.status.preparing",
  ready: "order.status.ready",
  delivered: "order.status.delivered",
};

/**
 * Phase-adaptive Denis dock — bottom of menu, tracks orders without blocking browse.
 */
export function DenisGuestDock({
  scene,
  currency,
  subtitle,
  onOpenDesk,
  onChipPress,
  onInlineAdd,
}: {
  scene: Scene;
  currency: string;
  subtitle?: string | null;
  onOpenDesk: () => void;
  onChipPress: (chipId: string, label: string) => void;
  onInlineAdd: (productId: string) => void;
}) {
  const { tUI } = useAppLocale();
  const situation = scene.chrome.situation;
  const chipsLayer = sceneChipsLayer(scene);
  const inlineLayers = sceneInlineLayers(scene);

  const defaultExpanded = useMemo(
    () =>
      scene.phase === "waiting" ||
      scene.phase === "settling" ||
      Boolean(situation?.hasReadyOrder),
    [scene.phase, situation?.hasReadyOrder]
  );

  const [expanded, setExpanded] = useState(defaultExpanded);

  const markState =
    scene.chrome.markState === "listen"
      ? "listen"
      : scene.chrome.markState === "think"
        ? "think"
        : situation?.hasReadyOrder
          ? "listen"
          : "idle";

  const collapsedLine = useMemo(() => {
    const lead = situation?.orders[0];
    if (lead) {
      const statusKey =
        STATUS_KEYS[lead.status] ?? "order.status.pending";
      const prep =
        lead.prepMinutes && lead.status === "preparing"
          ? ` · ~${lead.prepMinutes} min`
          : "";
      return `${lead.itemsLabel} · ${tUI(statusKey as "order.status.preparing")}${prep}`;
    }
    return (
      subtitle ?? tUI(`scene.phase.${scene.phase}` as "scene.phase.browsing")
    );
  }, [situation, subtitle, scene.phase, tUI]);

  const showExpandedContent =
    expanded &&
    (Boolean(situation?.orders.length) ||
      Boolean(chipsLayer?.options.length) ||
      inlineLayers.length > 0);

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 z-40 px-3",
        "bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))]"
      )}
    >
      <section
        className={cn(
          "denis-scene-shell pointer-events-auto overflow-hidden rounded-2xl border border-[var(--qr-elevated)] bg-[var(--qr-surface)]/95 shadow-[0_-8px_40px_rgba(0,0,0,0.45)] backdrop-blur-md",
          scene.chrome.markState === "think" && "denis-scene-shell--think",
          situation?.hasReadyOrder &&
            "ring-1 ring-[var(--qr-ember)]/40"
        )}
        aria-label="Denis"
      >
        <div
          className="pointer-events-none h-[2px] bg-[var(--qr-ember)]"
          aria-hidden
        />

        <div className="flex items-center gap-2 px-3 py-2.5">
          <DenisBrandMark markSize={24} markState={markState} markOnly />

          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="min-w-0 flex-1 text-left"
          >
            <p className="truncate text-sm font-semibold text-[var(--qr-ivory)]">
              Denis
            </p>
            <p className="truncate text-[12px] leading-snug text-[var(--qr-muted)]">
              {collapsedLine}
            </p>
          </button>

          <button
            type="button"
            onClick={onOpenDesk}
            className="shrink-0 rounded-full border border-[var(--qr-ember)]/30 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--qr-ember)]"
          >
            {tUI("scene.askDenisShort")}
          </button>

          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="flex size-8 shrink-0 items-center justify-center text-[var(--qr-muted)]"
            aria-expanded={expanded}
            aria-label={expanded ? tUI("scene.dockCollapse") : tUI("scene.dockExpand")}
          >
            {expanded ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronUp className="size-4" />
            )}
          </button>
        </div>

        {showExpandedContent ? (
          <div className="border-t border-[var(--qr-elevated)]/80">
            {situation?.orders.length ? (
              <DenisSituationView situation={situation} />
            ) : null}

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
          </div>
        ) : null}
      </section>
    </div>
  );
}
