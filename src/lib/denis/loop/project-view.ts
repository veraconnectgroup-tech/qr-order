import { emptyCartDraft } from "@/lib/denis/kernel/cart-projection";
import { resolveCartConflict } from "@/lib/denis/kernel/conflict";
import { foldTranscriptFromTimeline } from "@/lib/denis/loop/fold-transcript";
import type { FoldMeta, TableSessionState } from "@/lib/denis/loop/types";
import { toSceneAccessibility } from "@/lib/denis/cognition/mental-model/accessibility-types";
import {
  buildViewHeadline,
  buildViewLayers,
  buildViewMarkState,
  buildViewSituation,
  viewVersionFromTimeline,
} from "@/lib/denis/loop/project-view-layers";
import type {
  AvailableAction,
  CartView,
  OrderSummary,
  ProjectViewInput,
  TableSessionView,
  TellResult,
} from "@/lib/denis/loop/view-types";
import { sessionHasUnpaidOrders } from "@/lib/denis/loop/derive-fold-phase";
import { buildDenisDock } from "@/lib/denis/loop/build-denis-dock";
import { buildSmartTipOffer } from "@/lib/denis/commerce/build-smart-tip-offer";
import { DEFAULT_COMMERCE_POLICY } from "@/lib/commerce/policy/defaults";
import {
  resolveTableActionChips,
  TABLE_ACTION_CHIP_IDS,
} from "@/lib/scene/resolve-table-actions";

function mapOrders(orders: TableSessionState["commerce"]["orders"]): OrderSummary[] {
  return orders.map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    estimatedPrepMinutes: order.estimatedPrepMinutes,
    items: order.items,
  }));
}

function buildCartView(state: TableSessionState): CartView {
  const aiDraft = state.commerce.cart.ai.draft;
  const manualDraft = state.commerce.cart.manual ?? emptyCartDraft();
  const peerDraft = state.commerce.cart.peerManual;

  const conflict = resolveCartConflict({
    ai: aiDraft,
    manual: manualDraft,
    peerManual: peerDraft,
    config: state.config,
  });

  return {
    aiItemCount: aiDraft.items.length,
    manualItemCount: manualDraft.items.length,
    visibleItemCount: state.commerce.cart.visibleLines.length,
    hasConflict: conflict.hasConflict,
    conflictPrompt: conflict.guestPrompt,
    revision: Math.max(
      aiDraft.cartRevision,
      manualDraft.cartRevision,
      peerDraft?.cartRevision ?? 0
    ),
  };
}

function buildActions(
  meta: FoldMeta,
  orders: OrderSummary[]
): AvailableAction[] {
  const actions: AvailableAction[] = resolveTableActionChips({
    phase: meta.phase,
    hasUnpaidOrders: sessionHasUnpaidOrders(
      orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        estimatedPrepMinutes: order.estimatedPrepMinutes,
        createdAt: "",
        items: order.items,
      }))
    ),
  }).map((chip) => ({
    id: chip.id,
    labelKey: chip.labelKey,
    kind:
      chip.id === TABLE_ACTION_CHIP_IDS.viewBill
        ? ("bill" as const)
        : chip.id === TABLE_ACTION_CHIP_IDS.orderMore
          ? ("menu" as const)
          : ("chip" as const),
  }));

  for (const order of orders) {
    if (order.status === "delivered" || order.status === "cancelled") continue;
    actions.push({
      id: `order-${order.id}`,
      labelKey: "scene.situation.viewOrder",
      kind: "order",
      orderId: order.id,
    });
  }

  return actions;
}

/**
 * PROJECT — build guest FACE read model from folded Mind (ADR-019 Phase B).
 */
export function projectTableSessionView(
  state: TableSessionState,
  meta: FoldMeta,
  tellResult: TellResult,
  input: ProjectViewInput
): TableSessionView {
  const orders = mapOrders(state.commerce.orders);
  const situation = buildViewSituation(state);
  const dock = buildDenisDock({
    state,
    meta,
    situation,
    language: input.language,
  });
  const headline = buildViewHeadline(
    state,
    tellResult?.headline ?? dock.headline,
    meta.phase
  );
  const markState = buildViewMarkState(
    state,
    situation,
    tellResult?.markState
  );
  const smartTipOffer = buildSmartTipOffer({
    state,
    phase: meta.phase,
    language: input.language,
    policy: input.commercePolicy ?? DEFAULT_COMMERCE_POLICY,
  });
  const layers = buildViewLayers(
    state,
    meta,
    situation,
    input.language,
    smartTipOffer
  );
  const transcript = foldTranscriptFromTimeline(state.timeline);

  return {
    version: viewVersionFromTimeline(state),
    sessionId: input.sessionId,
    phase: meta.phase,
    chrome: {
      tableName: state.table.name,
      venueName: input.venueName,
      headline,
      markState,
      denisActive: state.session.denisActive,
    },
    layers,
    transcript,
    cart: buildCartView(state),
    orders,
    actions: buildActions(meta, orders),
    dock,
    smartTipOffer,
    accessibility: toSceneAccessibility(state.mental.accessibility ?? {
      preferredMode: "default",
      fontScale: 1,
      highContrast: false,
      reducedMotion: false,
    }),
  };
}
