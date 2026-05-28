"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import { useGuestScene } from "@/hooks/use-guest-scene";
import {
  parseSceneChipSelections,
  postGuestWaiterCall,
  runGuestDenisSceneTurn,
} from "@/lib/guest/denis-scene-turn";
import { hapticClick } from "@/lib/haptics";
import { buildManualCartSnapshot, manualCartRevision } from "@/lib/guest/manual-cart-snapshot";
import { useCart } from "@/hooks/use-cart";

const DenisGuestDock = dynamic(
  () =>
    import("@/components/guest/denis-guest-dock").then((m) => ({
      default: m.DenisGuestDock,
    })),
  { ssr: false }
);

const AiConciergeChat = dynamic(
  () =>
    import("@/components/guest/ai-concierge-chat").then((m) => ({
      default: m.AiConciergeChat,
    })),
  { ssr: false }
);

/**
 * Session-scoped Denis — dock + desk sheet on any guest surface (order, cart, …).
 * Scene-first: chips and situation, chat only via "Pitaj Denisa".
 */
export function GuestDenisLayer({
  enabled,
  slug,
  token,
  locationId,
  tableId,
  sessionToken,
  currency,
  taxPercent = 0,
  orderingDisabled = false,
  fastPoll = true,
  voiceEnabled = false,
  voiceTtsEnabled = true,
  sceneRefreshBump = 0,
}: {
  enabled: boolean;
  slug: string;
  token: string;
  locationId: string;
  tableId: string;
  sessionToken: string | null;
  currency: string;
  taxPercent?: number;
  orderingDisabled?: boolean;
  fastPoll?: boolean;
  voiceEnabled?: boolean;
  voiceTtsEnabled?: boolean;
  /** Increment to force scene reload (e.g. order status change). */
  sceneRefreshBump?: number;
}) {
  const { tUI, menuLocale, isEnglish } = useAppLocale();
  const language = isEnglish ? "en" : menuLocale;
  const cartItems = useCart((s) => s.items);
  const cartBump = useCart((s) => s.cartBump);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [sceneRefreshKey, setSceneRefreshKey] = useState(0);
  const [sceneTurnBusy, setSceneTurnBusy] = useState(false);

  const refreshKey = sceneRefreshKey + sceneRefreshBump;

  const { scene, refresh: refreshGuestSceneView } = useGuestScene({
    tableToken: token,
    sessionToken,
    enabled: enabled && !!sessionToken,
    refreshKey,
    fastPoll,
  });

  const handleOpenDenisDesk = useCallback(() => {
    hapticClick();
    setAiChatOpen(true);
  }, []);

  const handleAiChatOpenChange = useCallback((open: boolean) => {
    setAiChatOpen(open);
    if (!open) {
      setSceneRefreshKey((key) => key + 1);
    }
  }, []);

  const runSceneChipTurn = useCallback(
    async (input: {
      chipId: string;
      label: string;
      message?: string;
      selections?: ReturnType<typeof parseSceneChipSelections>;
    }) => {
      if (!sessionToken || sceneTurnBusy) return;

      setSceneTurnBusy(true);
      try {
        await runGuestDenisSceneTurn({
          locationId,
          tableId,
          tableToken: token,
          sessionToken,
          message: input.message ?? input.label,
          language,
          selections: input.selections ?? undefined,
          allowOrdering: !orderingDisabled,
        });
        setSceneRefreshKey((key) => key + 1);
        await refreshGuestSceneView();
      } catch {
        toast.error(tUI("ai.overlay.error"));
      } finally {
        setSceneTurnBusy(false);
      }
    },
    [
      sessionToken,
      sceneTurnBusy,
      locationId,
      tableId,
      token,
      language,
      orderingDisabled,
      refreshGuestSceneView,
      tUI,
    ]
  );

  const handleSceneChipPress = useCallback(
    (chipId: string, label: string) => {
      hapticClick();

      if (chipId === "situation-waiter") {
        if (!sessionToken) {
          toast.error(tUI("waiter.sessionError"), {
            description: tUI("waiter.sessionErrorHint"),
          });
          return;
        }
        void (async () => {
          try {
            await postGuestWaiterCall({ tableToken: token, sessionToken });
            toast.success(tUI("waiter.notified"), {
              description: tUI("waiter.notifiedBody"),
            });
            setSceneRefreshKey((key) => key + 1);
            await refreshGuestSceneView();
          } catch {
            toast.error(tUI("waiter.error"), {
              description: tUI("waiter.errorHint"),
            });
          }
        })();
        return;
      }

      if (chipId === "situation-wrong") {
        void runSceneChipTurn({
          chipId,
          label,
          message: tUI("scene.situation.chipWrong"),
        });
        return;
      }

      const selections = parseSceneChipSelections(chipId);
      if (selections) {
        void runSceneChipTurn({ chipId, label, selections });
        return;
      }

      void runSceneChipTurn({ chipId, label });
    },
    [sessionToken, token, tUI, refreshGuestSceneView, runSceneChipTurn]
  );

  const handleSceneInlineAdd = useCallback(() => {
    hapticClick();
    setAiChatOpen(true);
  }, []);

  if (!enabled || !sessionToken) return null;

  return (
    <>
      <AiConciergeChat
          open={aiChatOpen}
          onOpenChange={handleAiChatOpenChange}
          onSceneRefresh={() => void refreshGuestSceneView()}
          sceneChrome={scene?.chrome ?? null}
          slug={slug}
          token={token}
          locationId={locationId}
          tableId={tableId}
          sessionToken={sessionToken}
          currency={currency}
          taxPercent={taxPercent}
          orderingDisabled={orderingDisabled}
          voiceEnabled={voiceEnabled}
          voiceTtsEnabled={voiceTtsEnabled}
          getManualCartSnapshot={() => {
          if (cartItems.length === 0) return undefined;
          return buildManualCartSnapshot(
            cartItems,
            manualCartRevision(cartItems, cartBump)
          );
        }}
      />

      {scene && !aiChatOpen ? (
        <DenisGuestDock
          scene={scene}
          currency={currency}
          subtitle={scene.chrome.situation?.headline ?? undefined}
          onOpenDesk={handleOpenDenisDesk}
          onChipPress={handleSceneChipPress}
          onInlineAdd={handleSceneInlineAdd}
          busy={sceneTurnBusy}
        />
      ) : null}
    </>
  );
}
