"use client";

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import { useDenisView } from "@/hooks/use-denis-view";
import type { ProductRecommendation } from "@/components/guest/product-recommendation-card";
import type { MenuCategory } from "@/components/guest/menu-grid";
import {
  parseSceneChipSelections,
  parseSceneHandoffChip,
  runGuestDenisSceneTurn,
  type GuestDenisTurnResult,
} from "@/lib/guest/denis-scene-turn";
import { hapticClick } from "@/lib/haptics";
import { getOrCreateDeviceFingerprint } from "@/lib/guest/device-storage";
import { requestGuestWaiterCall } from "@/lib/guest/request-waiter-call";
import { TABLE_ACTION_CHIP_IDS } from "@/lib/scene/resolve-table-actions";
import type { InPersonPaymentLocation } from "@/lib/constants";
import type { TableSessionView } from "@/lib/denis/loop/view-types";
import type { Scene } from "@/lib/scene/types";
import type { AllergenId } from "@/lib/allergens";
import type { AiSheetAllergyId, AiSheetSelections } from "@/lib/ai/guest-sheet-preferences";
import type { GuestMemoryProfile } from "@/lib/guest/guest-memory-storage";
import type { MenuSection } from "@/lib/menu-section";

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

export type GuestDenisControlledView = {
  view: TableSessionView | null;
  scene: Scene | null;
  loading: boolean;
  refresh: () => void;
};

export type GuestDenisMenuChatProps = {
  isDemo?: boolean;
  menuCategories?: MenuCategory[];
  menuSectionByProductId?: Map<string, MenuSection>;
  productTaxRateById?: Map<string, number | null>;
  scrollContext?: () => string | null;
  guestProfile?: GuestMemoryProfile;
  isReturning?: boolean;
  onAddToCart?: (rec: ProductRecommendation) => void;
  customizableProductIds?: Set<string>;
  onOpenProductDetail?: (productId: string) => void;
  onRecommendations?: (payload: {
    recommendations: ProductRecommendation[];
    sessionId: string | null;
    preferences: { allergies: string[]; mood: string };
    allergenIds: AllergenId[];
  }) => void;
  onSaveAllergies?: (
    allergies: string[],
    sheetIds: AiSheetAllergyId[]
  ) => void;
};

/**
 * Session-scoped Denis — dock + desk sheet on any guest surface (order, cart, …).
 * F4 view-only: render from GET /api/denis/view; cart sync via sense signal only.
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
  voiceEnabled = false,
  voiceTtsEnabled = true,
  dockPlacement = "bottom",
  cartBarVisible = false,
  stripeOnboarded = false,
  paymentOnlineEnabled = false,
  paymentAtBarEnabled = false,
  paymentCardAtTableEnabled = false,
  inPersonPaymentLocation = "bar" as InPersonPaymentLocation,
  controlledView,
  tableName,
  venueName,
  dockSubtitle,
  orderMoreChipAction = "navigate",
  getBrowsingContext,
  onChatOpenChange,
  onSceneTurnResult,
  onSceneChipSelections,
  onInlineAddProduct,
  menuChat,
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
  voiceEnabled?: boolean;
  voiceTtsEnabled?: boolean;
  dockPlacement?: "bottom" | "sticky-top";
  cartBarVisible?: boolean;
  stripeOnboarded?: boolean;
  paymentOnlineEnabled?: boolean;
  paymentAtBarEnabled?: boolean;
  paymentCardAtTableEnabled?: boolean;
  inPersonPaymentLocation?: InPersonPaymentLocation;
  /** Parent-owned view (menu surface) — avoids duplicate fetch. */
  controlledView?: GuestDenisControlledView;
  tableName?: string;
  venueName?: string;
  dockSubtitle?: string;
  orderMoreChipAction?: "navigate" | "scroll";
  getBrowsingContext?: () => string | null;
  onChatOpenChange?: (open: boolean) => void;
  onSceneTurnResult?: (result: GuestDenisTurnResult) => void;
  onSceneChipSelections?: (selections: AiSheetSelections) => void;
  onInlineAddProduct?: (productId: string) => void;
  menuChat?: GuestDenisMenuChatProps;
}) {
  const { tUI, menuLocale, isEnglish } = useAppLocale();
  const language = isEnglish ? "en" : menuLocale;
  const deviceFingerprint = useMemo(() => getOrCreateDeviceFingerprint(), []);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [sceneTurnBusy, setSceneTurnBusy] = useState(false);
  const [focusOrderId, setFocusOrderId] = useState<string | null>(null);
  const [billSheetOpen, setBillSheetOpen] = useState(false);

  const internalView = useDenisView({
    tableToken: token,
    sessionToken,
    enabled: enabled && !!sessionToken && !controlledView,
  });

  const view = controlledView?.view ?? internalView.view;
  const scene = controlledView?.scene ?? internalView.scene;
  const sceneLoading = controlledView?.loading ?? internalView.loading;
  const refreshGuestSceneView =
    controlledView?.refresh ?? internalView.refresh;

  const handleOpenDenisDesk = useCallback(() => {
    hapticClick();
    setAiChatOpen(true);
    onChatOpenChange?.(true);
  }, [onChatOpenChange]);

  const handleAiChatOpenChange = useCallback(
    (open: boolean) => {
      setAiChatOpen(open);
      onChatOpenChange?.(open);
    },
    [onChatOpenChange]
  );

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
        const result = await runGuestDenisSceneTurn({
          locationId,
          tableId,
          tableToken: token,
          sessionToken,
          message: input.message ?? input.label,
          language,
          browsingContext: getBrowsingContext?.() ?? undefined,
          selections: input.selections ?? undefined,
          allowOrdering: !orderingDisabled,
        });
        onSceneTurnResult?.(result);
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
      getBrowsingContext,
      orderingDisabled,
      onSceneTurnResult,
      refreshGuestSceneView,
      tUI,
    ]
  );

  const handleSceneChipPress = useCallback(
    (chipId: string, label: string) => {
      hapticClick();

      if (chipId === TABLE_ACTION_CHIP_IDS.orderMore) {
        if (orderMoreChipAction === "scroll") {
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          window.location.href = `/${slug}/${token}`;
        }
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
            const result = await runGuestDenisSceneTurn({
              locationId,
              tableId,
              tableToken: token,
              sessionToken,
              message: label,
              language,
              structuredIntent: handoffChip.structuredIntent,
              handoffPaymentMethod: handoffChip.handoffPaymentMethod,
              allowOrdering: !orderingDisabled,
            });
            if (result.openPaymentSheet) {
              setBillSheetOpen(true);
            }
            onSceneTurnResult?.(result);
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
        onSceneChipSelections?.(selections);
        void runSceneChipTurn({ chipId, label, selections });
        return;
      }

      void runSceneChipTurn({ chipId, label });
    },
    [
      orderMoreChipAction,
      sessionToken,
      slug,
      token,
      tUI,
      refreshGuestSceneView,
      runSceneChipTurn,
      onSceneChipSelections,
      onSceneTurnResult,
      locationId,
      tableId,
      language,
      orderingDisabled,
    ]
  );

  const handleSceneInlineAdd = useCallback(
    (productId: string) => {
      hapticClick();
      if (onInlineAddProduct) {
        onInlineAddProduct(productId);
        return;
      }
      setAiChatOpen(true);
      onChatOpenChange?.(true);
    },
    [onInlineAddProduct, onChatOpenChange]
  );

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
        onViewRefresh={() => void refreshGuestSceneView()}
        isDemo={menuChat?.isDemo}
        menuCategories={menuChat?.menuCategories}
        menuSectionByProductId={menuChat?.menuSectionByProductId}
        productTaxRateById={menuChat?.productTaxRateById}
        scrollContext={menuChat?.scrollContext ?? getBrowsingContext}
        guestProfile={menuChat?.guestProfile}
        isReturning={menuChat?.isReturning}
        onAddToCart={menuChat?.onAddToCart}
        customizableProductIds={menuChat?.customizableProductIds}
        onOpenProductDetail={menuChat?.onOpenProductDetail}
        onRecommendations={menuChat?.onRecommendations}
        onSaveAllergies={menuChat?.onSaveAllergies}
      />

      {!aiChatOpen ? (
        <DenisGuestDock
          scene={scene}
          currency={currency}
          placement={dockPlacement}
          cartBarVisible={cartBarVisible}
          tableName={tableName}
          venueName={venueName}
          loading={sceneLoading && !scene}
          headline={view?.chrome.headline}
          subtitle={dockSubtitle ?? scene?.chrome.situation?.headline ?? undefined}
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
