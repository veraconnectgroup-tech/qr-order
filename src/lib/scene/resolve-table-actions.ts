import type { SceneSituationAction, SessionPhase } from "./types";
import { isPaidPaymentStatus } from "@/lib/orders/payment-status";

export const TABLE_ACTION_CHIP_IDS = {
  orderMore: "action-order-more",
  viewBill: "action-view-bill",
} as const;

export function resolveSituationOrderAction(input: {
  orderId: string;
  status: string;
  paymentStatus: string;
}): SceneSituationAction {
  if (
    !isPaidPaymentStatus(input.paymentStatus) &&
    input.status === "delivered"
  ) {
    return {
      kind: "open_bill",
      scope: "order",
      orderId: input.orderId,
    };
  }
  if (input.status === "delivered" || input.status === "cancelled") {
    return { kind: "open_menu" };
  }
  return { kind: "open_order", orderId: input.orderId };
}

/** Deterministic session chips — SC-8 table continuity (not LLM). */
export function resolveTableActionChips(input: {
  phase: SessionPhase;
  hasUnpaidOrders: boolean;
}): Array<{ id: string; labelKey: string }> {
  const chips: Array<{ id: string; labelKey: string }> = [];

  if (input.phase !== "closed") {
    chips.push({
      id: TABLE_ACTION_CHIP_IDS.orderMore,
      labelKey: "scene.action.orderMore",
    });
  }

  if (input.hasUnpaidOrders) {
    chips.push({
      id: TABLE_ACTION_CHIP_IDS.viewBill,
      labelKey: "scene.action.viewBill",
    });
  }

  return chips;
}

export function isTableActionChipId(chipId: string): boolean {
  return (
    chipId === TABLE_ACTION_CHIP_IDS.orderMore ||
    chipId === TABLE_ACTION_CHIP_IDS.viewBill
  );
}
