"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronUp } from "lucide-react";
import { DenisMarkBadge } from "@/components/design-system/denis-mark-badge";
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
 * Denis surface on guest pages.
 * - bottom: fixed above cart bar (menu)
 * - sticky-top: sticks under safe area (order tracking — avoids floating mid-screen)
 */
export function DenisGuestDock({
  scene,
  currency,
  headline,
  subtitle,
  tableName,
  venueName,
  loading = false,
  placement = "bottom",
  cartBarVisible = false,
  onOpenDesk,
  onChipPress,
  onInlineAdd,
  onOrderPress,
  busy = false,
}: {
  scene?: Scene | null;
  currency: string;
  /** ADR-019 view headline — preferred over situation/subtitle on order page. */
  headline?: string | null;
  subtitle?: string | null;
  tableName?: string;
  venueName?: string;
  loading?: boolean;
  placement?: "bottom" | "sticky-top";
  /** When true, sit above the fixed cart summary bar (menu). */
  cartBarVisible?: boolean;
  onOpenDesk: () => void;
  onChipPress: (chipId: string, label: string) => void;
  onInlineAdd: (productId: string) => void;
  onOrderPress?: (orderId: string) => void;
  busy?: boolean;
}) {
  const { tUI } = useAppLocale();
  const situation = scene?.chrome.situation ?? null;
  const chipsLayer = scene ? sceneChipsLayer(scene) : null;
  const inlineLayers = scene ? sceneInlineLayers(scene) : [];

  const defaultExpanded = useMemo(
    () =>
      Boolean(
        scene &&
          (scene.phase === "waiting" ||
            scene.phase === "settling" ||
            situation?.hasReadyOrder ||
            (chipsLayer?.options.length && scene.phase === "browsing"))
      ),
    [scene, situation?.hasReadyOrder, chipsLayer?.options.length]
  );

  const [expanded, setExpanded] = useState(defaultExpanded);

  useEffect(() => {
    if (defaultExpanded) setExpanded(true);
  }, [defaultExpanded]);

  const markState = loading
    ? "think"
    : busy || scene?.chrome.markState === "think"
      ? "think"
      : scene?.chrome.markState === "listen"
        ? "listen"
        : situation?.hasReadyOrder
          ? "listen"
          : "idle";

  const collapsedLine = useMemo(() => {
    if (headline) return headline;
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
    if (subtitle) return subtitle;
    if (loading) return tUI("scene.loading");
    if (scene) {
      return tUI(`scene.phase.${scene.phase}` as "scene.phase.browsing");
    }
    return tUI("ai.intro.subtitle");
  }, [headline, situation, subtitle, loading, scene, tUI]);

  const tableContext = useMemo(() => {
    const table = scene?.chrome.tableName ?? tableName;
    const venue = scene?.chrome.venueName ?? venueName;
    if (!table && !venue) return null;
    return [table, venue].filter(Boolean).join(" · ");
  }, [scene, tableName, venueName]);

  const showExpandedContent =
    expanded &&
    scene &&
    (Boolean(situation?.orders.length) ||
      Boolean(chipsLayer?.options.length) ||
      inlineLayers.length > 0);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const dock = (
    <div
      className={cn(
        "guest-theme pointer-events-none z-50 px-3",
        placement === "bottom"
          ? cartBarVisible
            ? "fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))]"
            : "fixed inset-x-0 bottom-0 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]"
          : "sticky top-[max(0px,env(safe-area-inset-top))] -mx-1 mb-4"
      )}
    >
      <section
        className={cn(
          "denis-scene-shell pointer-events-auto mx-auto w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--qr-elevated)] bg-[var(--qr-surface)]/95 text-[var(--qr-ivory)] backdrop-blur-md",
          placement === "bottom"
            ? "shadow-[0_-8px_40px_rgba(0,0,0,0.45)]"
            : "shadow-[0_8px_32px_rgba(0,0,0,0.35)]",
          (busy || scene?.chrome.markState === "think" || loading) &&
            "denis-scene-shell--think",
          situation?.hasReadyOrder && "ring-1 ring-[var(--qr-ember)]/40"
        )}
        aria-label="Denis"
      >
        <div
          className="pointer-events-none h-[2px] bg-[var(--qr-ember)]"
          aria-hidden
        />

        <div className="flex items-center gap-2 px-3 py-2.5">
          <DenisMarkBadge size="md" markState={markState} />

          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="min-w-0 flex-1 text-left"
            disabled={!scene}
          >
            <p className="truncate text-sm font-semibold text-[var(--qr-ivory)]">
              Denis
            </p>
            {tableContext ? (
              <p className="truncate text-[11px] font-medium text-[var(--qr-ivory)]/72">
                {tableContext}
              </p>
            ) : null}
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

          {scene ? (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="flex size-8 shrink-0 items-center justify-center text-[var(--qr-muted)]"
              aria-expanded={expanded}
              aria-label={
                expanded ? tUI("scene.dockCollapse") : tUI("scene.dockExpand")
              }
            >
              {expanded ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronUp className="size-4" />
              )}
            </button>
          ) : null}
        </div>

        {showExpandedContent ? (
          <div className="border-t border-[var(--qr-elevated)]/80">
            {situation?.orders.length ? (
              <DenisSituationView
                situation={situation}
                onOrderPress={onOrderPress}
              />
            ) : null}

            {chipsLayer?.options.length ? (
              <div className="border-t border-[var(--qr-elevated)]/80 px-3 pb-3 pt-2">
                <DenisSceneChips scene={scene!} onChipPress={onChipPress} />
              </div>
            ) : null}

            {inlineLayers.length ? (
              <div className="border-t border-[var(--qr-elevated)]/80">
                <DenisSceneInlineRecommendations
                  scene={scene!}
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

  if (placement === "bottom" && mounted) {
    return createPortal(dock, document.body);
  }

  return dock;
}
