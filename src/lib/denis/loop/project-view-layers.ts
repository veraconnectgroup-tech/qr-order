import {
  AI_SHEET_ALLERGY_OPTIONS,
  AI_SHEET_MOOD_OPTIONS,
} from "@/lib/ai/guest-sheet-preferences";
import { resolveExperienceMoment } from "@/lib/commerce/experience/resolve-experience-moment";
import { resolveCartConflict } from "@/lib/denis/kernel/conflict";
import { emptyCartDraft } from "@/lib/denis/kernel/cart-projection";
import {
  buildProactiveBannerLayers,
} from "@/lib/denis/loop/build-proactive-banner-layers";
import type { FoldMeta, TableSessionState } from "@/lib/denis/loop/types";
import {
  deriveGuestSituation,
  situationSupportChips,
} from "@/lib/scene/derive-guest-situation";
import { resolveTableActionChips } from "@/lib/scene/resolve-table-actions";
import type {
  SceneLayer,
  SceneMarkState,
  SceneSituation,
  SessionPhase,
} from "@/lib/scene/types";
import { isPaidPaymentStatus } from "@/lib/orders/payment-status";

const LAYER_PRIORITY: Record<SceneLayer["kind"], number> = {
  blocking: 0,
  sheet: 1,
  banner: 2,
  inline: 3,
  chips: 4,
  ambient: 5,
};

function defaultOnboardingChips(): Array<{ id: string; label: string }> {
  return [
    ...AI_SHEET_ALLERGY_OPTIONS.slice(0, 4).map((option) => ({
      id: `allergy-${option.id}`,
      label: option.label,
    })),
    ...AI_SHEET_MOOD_OPTIONS.slice(0, 2).map((option) => ({
      id: `mood-${option.id}`,
      label: option.label,
    })),
  ];
}

function resolveViewChips(input: {
  denisEnabled: boolean;
  denisActive: boolean;
  phase: SessionPhase;
  situation: SceneSituation | null;
  hasUnpaidOrders: boolean;
}): Array<{ id: string; label: string }> {
  const tableActions = resolveTableActionChips({
    phase: input.phase,
    hasUnpaidOrders: input.hasUnpaidOrders,
  }).map((chip) => ({ id: chip.id, label: chip.labelKey }));

  const situationChips =
    input.situation?.hasActiveKitchen ||
    input.situation?.hasReadyOrder ||
    input.phase === "waiting"
      ? situationSupportChips().map((chip) => ({
          id: chip.id,
          label: chip.labelKey,
        }))
      : [];

  const merged = [...tableActions, ...situationChips];
  if (merged.length) return merged;

  if (input.denisEnabled && !input.denisActive && input.phase === "browsing") {
    return defaultOnboardingChips();
  }

  return [];
}

function buildViewBanners(
  state: TableSessionState,
  situation: SceneSituation | null
): Array<{
  id: string;
  message: string;
  action?: "open_sheet" | "feedback";
}> {
  const banners: Array<{
    id: string;
    message: string;
    action?: "open_sheet" | "feedback";
  }> = [];

  if (situation?.hasReadyOrder) {
    banners.push({
      id: "order-ready",
      message: situation.headline,
      action: "open_sheet",
    });
  }

  const { ops } = state.venue;
  if (ops.staffHint?.visibility === "guest_safe" && ops.staffHint.text) {
    banners.push({
      id: "staff-hint",
      message: ops.staffHint.text,
      action: "open_sheet",
    });
  }

  if (ops.kdsStress === "high" || ops.operatingMode === "rush") {
    banners.push({
      id: "venue-rush",
      message: "Kitchen is busy — we can suggest drinks while you wait.",
      action: "open_sheet",
    });
  }

  const orders = state.commerce.orders;
  const allOrdersDelivered =
    orders.length > 0 && orders.every((order) => order.status === "delivered");
  const latestPaidOrder = [...orders].reverse().find((order) =>
    isPaidPaymentStatus(order.paymentStatus)
  );

  if (latestPaidOrder) {
    const moment = resolveExperienceMoment({
      paymentStatus: latestPaidOrder.paymentStatus,
      orderStatus: latestPaidOrder.status,
      sessionBillSettled: state.session.billSettled,
      allSessionOrdersDelivered: allOrdersDelivered,
      feedbackAlreadySubmitted: state.session.feedbackSubmitted,
    });

    if (moment === "feedback_eligible") {
      banners.push({
        id: "feedback",
        message: "How was your visit?",
        action: "feedback",
      });
    }
  }

  return banners;
}

function viewHasCartConflict(state: TableSessionState): boolean {
  const aiDraft = state.commerce.cart.ai.draft;
  const manualDraft = state.commerce.cart.manual ?? emptyCartDraft();
  return resolveCartConflict({
    ai: aiDraft,
    manual: manualDraft,
    peerManual: state.commerce.cart.peerManual,
    config: state.config,
  }).hasConflict;
}

export function buildViewSituation(
  state: TableSessionState
): SceneSituation | null {
  return deriveGuestSituation(
    state.commerce.orders.map((order) => ({
      id: order.id,
      order_number: order.orderNumber,
      status: order.status,
      payment_status: order.paymentStatus,
      estimated_prep_minutes: order.estimatedPrepMinutes,
      order_items: order.items.map((item) => ({
        product_name: item.productName,
        quantity: item.quantity,
      })),
    }))
  );
}

export function buildViewHeadline(
  situation: SceneSituation | null,
  phase: SessionPhase,
  tellHeadline?: string
): string {
  if (tellHeadline) return tellHeadline;
  if (situation?.headline) return situation.headline;
  return phase;
}

export function buildViewMarkState(
  state: TableSessionState,
  situation: SceneSituation | null,
  tellMarkState?: SceneMarkState
): SceneMarkState {
  if (tellMarkState) return tellMarkState;
  if (situation?.hasReadyOrder) return "listen";
  if (viewHasCartConflict(state)) return "think";
  return "idle";
}

export function buildViewLayers(
  state: TableSessionState,
  meta: FoldMeta,
  situation: SceneSituation | null
): SceneLayer[] {
  const hasUnpaidOrders = state.commerce.orders.some(
    (order) => !isPaidPaymentStatus(order.paymentStatus)
  );

  const chips = resolveViewChips({
    denisEnabled: state.session.denisEnabled,
    denisActive: state.session.denisActive,
    phase: meta.phase,
    situation,
    hasUnpaidOrders,
  });

  const layers: SceneLayer[] = [];

  const waiterGap = state.conversation.obligation?.gaps[0];
  if (waiterGap) {
    layers.push({
      kind: "banner",
      id: `waiter-gap-${waiterGap.kind}`,
      message: waiterGap.prompt,
      action: "open_sheet",
    });
  }

  for (const banner of buildProactiveBannerLayers(state)) {
    layers.push({
      kind: "banner",
      id: banner.id,
      message: banner.message,
      action: banner.action,
      productId: banner.productId,
      productName: banner.productName,
      orderId: banner.orderId,
    });
  }

  for (const banner of buildViewBanners(state, situation)) {
    layers.push({
      kind: "banner",
      id: banner.id,
      message: banner.message,
      action: banner.action,
    });
  }

  if (chips.length > 0) {
    layers.push({ kind: "chips", options: chips });
  }

  if (state.session.denisActive) {
    layers.push({ kind: "ambient" });
  }

  layers.sort((a, b) => LAYER_PRIORITY[a.kind] - LAYER_PRIORITY[b.kind]);
  return layers;
}

export function viewVersionFromTimeline(state: TableSessionState): number {
  const lastSeq = state.timeline.at(-1)?.seq;
  return Math.max(1, lastSeq ?? 1);
}
