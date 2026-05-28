import { emptyCartDraft } from "@/lib/denis/kernel/cart-projection";
import { resolveCartConflict } from "@/lib/denis/kernel/conflict";
import { foldTranscriptFromTimeline } from "@/lib/denis/loop/fold-transcript";
import type { TableSessionState } from "@/lib/denis/loop/types";
import type {
  AvailableAction,
  CartView,
  OrderSummary,
  ProjectViewInput,
  TableSessionView,
  TellResult,
} from "@/lib/denis/loop/view-types";
import { sessionHasUnpaidOrders } from "@/lib/denis/loop/derive-fold-phase";
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
  input: ProjectViewInput,
  orders: OrderSummary[]
): AvailableAction[] {
  const actions: AvailableAction[] = resolveTableActionChips({
    phase: input.phase,
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
  tellResult: TellResult,
  input: ProjectViewInput
): TableSessionView {
  const orders = mapOrders(state.commerce.orders);

  return {
    version: input.version,
    sessionId: input.sessionId,
    phase: input.phase,
    chrome: {
      tableName: state.table.name,
      venueName: input.venueName,
      headline: tellResult?.headline ?? input.headline,
      markState: tellResult?.markState ?? input.markState ?? "idle",
      denisActive: input.denisActive,
    },
    layers: input.layers,
    transcript: foldTranscriptFromTimeline(state.timeline),
    cart: buildCartView(state),
    orders,
    actions: buildActions(input, orders),
  };
}
