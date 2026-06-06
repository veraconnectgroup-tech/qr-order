"use client";

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import { useDenisView } from "@/hooks/use-denis-view";
import {
  parseSceneChipSelections,
  parseSceneHandoffChip,
  runGuestDenisSceneTurn,
} from "@/lib/guest/denis-scene-turn";
import { hapticClick } from "@/lib/haptics";
import { buildManualCartSnapshot, manualCartRevision } from "@/lib/guest/manual-cart-snapshot";
import { getOrCreateDeviceFingerprint } from "@/lib/guest/device-storage";
import { requestGuestWaiterCall } from "@/lib/guest/request-waiter-call";
import { useCart } from "@/hooks/use-cart";
import { TABLE_ACTION_CHIP_IDS } from "@/lib/scene/resolve-table-actions";
import type { InPersonPaymentLocation } from "@/lib/constants";

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

const GuestOrderFocusSheet = dynamic(
  () =>
    import("@/components/guest/guest-order-focus-sheet").then((m) => ({
      default: m.GuestOrderFocusSheet,
    })),
  { ssr: false }
);

const GuestSessionBillSheet = dynamic(
  () =>
    import("@/components/guest/guest-session-bill-sheet").then((m) => ({
      default: m.GuestSessionBillSheet,
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
  dockPlacement = "bottom",
  cartBarVisible = false,
  stripeOnboarded = false,
  paymentOnlineEnabled = false,
  paymentAtBarEnabled = false,
  paymentCardAtTableEnabled = false,
  inPersonPaymentLocation = "bar" as InPersonPaymentLocation,
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
  dockPlacement?: "bottom" | "sticky-top";
  cartBarVisible?: boolean;
  stripeOnboarded?: boolean;
  paymentOnlineEnabled?: boolean;
  paymentAtBarEnabled?: boolean;
  paymentCardAtTableEnabled?: boolean;
  inPersonPaymentLocation?: InPersonPaymentLocation;
}) {
  const { tUI, menuLocale, isEnglish } = useAppLocale();
  const language = isEnglish ? "en" : menuLocale;
  const cartItems = useCart((s) => s.items);
  const cartBump = useCart((s) => s.cartBump);
  const deviceFingerprint = useMemo(() => getOrCreateDeviceFingerprint(), []);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [sceneRefreshKey, setSceneRefreshKey] = useState(0);
  const [sceneTurnBusy, setSceneTurnBusy] = useState(false);
  const [focusOrderId, setFocusOrderId] = useState<string | null>(null);
  const [billSheetOpen, setBillSheetOpen] = useState(false);

  const refreshKey = sceneRefreshKey + sceneRefreshBump;

  const { scene, view, refresh: refreshGuestSceneView } = useDenisView({
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

      if (chipId === TABLE_ACTION_CHIP_IDS.orderMore) {
        window.location.href = `/${slug}/${token}`;
        return;
      }

      if (chipId === TABLE_ACTION_CHIP_IDS.viewBill) {
        setBillSheetOpen(true);
        return;
      }

      if (chipId === "situation-waiter") {
        void (async () => {
          try {
            await requestGuestWaiterCall({
              tableToken: token,
              sessionToken,
            });
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

      const handoffChip = parseSceneHandoffChip(chipId, label);
      if (handoffChip?.structuredIntent) {
        if (!sessionToken) {
          toast.error(tUI("waiter.sessionError"), {
            description: tUI("waiter.sessionErrorHint"),
          });
          return;
        }
        void (async () => {
          try {
            await runGuestDenisSceneTurn({
              locationId,
              tableId,
              tableToken: token,
              sessionToken,
              message: label,
              language,
              structuredIntent: handoffChip.structuredIntent,
              handoffPaymentMethod: handoffChip.handoffPaymentMethod,
              allowOrdering: !orderingDisabled,
            }).then((result) => {
              if (result.openPaymentSheet) {
                setBillSheetOpen(true);
              }
            });
            setSceneRefreshKey((key) => key + 1);
            await refreshGuestSceneView();
          } catch {
            toast.error(tUI("ai.overlay.error"));
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
    [sessionToken, slug, token, tUI, refreshGuestSceneView, runSceneChipTurn, locationId, tableId, language, orderingDisabled]
  );

  const handleSceneInlineAdd = useCallback(() => {
    hapticClick();
    setAiChatOpen(true);
  }, []);

  const handleOrderPress = useCallback(
    (orderId: string) => {
      hapticClick();
      const order = scene?.chrome.situation?.orders.find(
        (row) => row.orderId === orderId
      );
      if (order?.primaryAction.kind === "open_bill") {
        setBillSheetOpen(true);
        return;
      }
      setFocusOrderId(orderId);
    },
    [scene]
  );

  if (!enabled) return null;

  return (
    <>
      <AiConciergeChat
          open={aiChatOpen}
          onOpenChange={handleAiChatOpenChange}
          onSceneRefresh={() => void refreshGuestSceneView()}
          onOpenPaymentSheet={() => setBillSheetOpen(true)}
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
          deviceFingerprint={deviceFingerprint}
          bootstrapTranscript={view?.transcript}
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
          placement={dockPlacement}
          cartBarVisible={cartBarVisible}
          headline={
            view ? view.chrome.headline : scene.chrome.situation?.headline
          }
          subtitle={scene.chrome.situation?.headline ?? undefined}
          onOpenDesk={handleOpenDenisDesk}
          onChipPress={handleSceneChipPress}
          onInlineAdd={handleSceneInlineAdd}
          onOrderPress={handleOrderPress}
          busy={sceneTurnBusy}
        />
      ) : null}

      {sessionToken ? (
        <>
          <GuestOrderFocusSheet
            open={focusOrderId != null}
            onOpenChange={(open) => {
              if (!open) setFocusOrderId(null);
            }}
            orderId={focusOrderId}
            slug={slug}
            token={token}
            sessionToken={sessionToken}
            currency={currency}
            stripeOnboarded={stripeOnboarded}
            paymentOnlineEnabled={paymentOnlineEnabled}
            paymentAtBarEnabled={paymentAtBarEnabled}
            paymentCardAtTableEnabled={paymentCardAtTableEnabled}
            inPersonPaymentLocation={inPersonPaymentLocation}
          />

          <GuestSessionBillSheet
            open={billSheetOpen}
            onOpenChange={setBillSheetOpen}
            slug={slug}
            token={token}
            sessionToken={sessionToken}
            currency={currency}
            stripeOnboarded={stripeOnboarded}
            paymentOnlineEnabled={paymentOnlineEnabled}
            paymentAtBarEnabled={paymentAtBarEnabled}
            paymentCardAtTableEnabled={paymentCardAtTableEnabled}
            inPersonPaymentLocation={inPersonPaymentLocation}
          />
        </>
      ) : null}
    </>
  );
}
