import { CONTEXTUAL_CHIP_IDS } from "@/lib/denis/loop/derive-contextual-chips";
import type { SceneSituationAction, SessionPhase } from "./types";
import { isPaidPaymentStatus } from "@/lib/orders/payment-status";

export const TABLE_ACTION_CHIP_IDS = {
  orderMore: "action-order-more",
  viewBill: "action-view-bill",
} as const;

/** Phase-scoped chip ids — scene intelligence (Prompt 31). */
export const PHASE_SCENE_CHIP_IDS = {
  viewMenu: "phase-view-menu",
  thatsAll: "phase-thats-all",
  splitBill: "phase-split-bill",
  leaveTip: "phase-leave-tip",
} as const;

type PhaseChipCopy = {
  recommend: string;
  viewMenu: string;
  callWaiter: string;
  orderMore: string;
  thatsAll: string;
  changeOrder: string;
  orderStatus: string;
  addDrink: string;
  viewBill: string;
  payCard: string;
  splitBill: string;
  leaveTip: string;
};

function phaseChipCopy(language?: string): PhaseChipCopy {
  const lang = (language ?? "sr").toLowerCase().slice(0, 2);
  if (lang === "de") {
    return {
      recommend: "Empfehlung",
      viewMenu: "Speisekarte",
      callWaiter: "Kellner rufen",
      orderMore: "Mehr bestellen",
      thatsAll: "Das war's",
      changeOrder: "Ändern",
      orderStatus: "Wo ist meine Bestellung?",
      addDrink: "Noch ein Drink",
      viewBill: "Rechnung",
      payCard: "Mit Karte zahlen",
      splitBill: "Rechnung teilen",
      leaveTip: "Trinkgeld",
    };
  }
  if (lang === "en") {
    return {
      recommend: "Recommend me",
      viewMenu: "Show menu",
      callWaiter: "Call waiter",
      orderMore: "Order more",
      thatsAll: "That's all",
      changeOrder: "Change order",
      orderStatus: "Where's my order?",
      addDrink: "Another drink",
      viewBill: "Bill",
      payCard: "Pay by card",
      splitBill: "Split bill",
      leaveTip: "Leave a tip",
    };
  }
  return {
    recommend: "Preporuči mi",
    viewMenu: "Vidim meni",
    callWaiter: "Pozovi konobara",
    orderMore: "Još nešto",
    thatsAll: "To je sve",
    changeOrder: "Promeni narudžbinu",
    orderStatus: "Gde je moja narudžbina?",
    addDrink: "Još jedno piće",
    viewBill: "Račun",
    payCard: "Plati karticom",
    splitBill: "Podeli račun",
    leaveTip: "Ostavi napojnicu",
  };
}

/** Smart phase chips — deterministic, not LLM (Prompt 31 / SC-8). */
export function resolvePhaseSceneChips(input: {
  phase: SessionPhase;
  language?: string;
  hasUnpaidOrders?: boolean;
}): Array<{ id: string; label: string }> {
  const copy = phaseChipCopy(input.language);

  switch (input.phase) {
    case "browsing":
    case "latent":
      return [
        { id: CONTEXTUAL_CHIP_IDS.recommend, label: copy.recommend },
        { id: PHASE_SCENE_CHIP_IDS.viewMenu, label: copy.viewMenu },
        { id: "situation-waiter", label: copy.callWaiter },
      ];
    case "ordering":
      return [
        { id: TABLE_ACTION_CHIP_IDS.orderMore, label: copy.orderMore },
        { id: PHASE_SCENE_CHIP_IDS.thatsAll, label: copy.thatsAll },
        { id: CONTEXTUAL_CHIP_IDS.changeOrder, label: copy.changeOrder },
      ];
    case "waiting":
      return [
        { id: CONTEXTUAL_CHIP_IDS.orderStatus, label: copy.orderStatus },
        { id: CONTEXTUAL_CHIP_IDS.addDrinkWaiting, label: copy.addDrink },
        { id: TABLE_ACTION_CHIP_IDS.viewBill, label: copy.viewBill },
      ];
    case "settling":
      return [
        { id: "pay-online", label: copy.payCard },
        { id: PHASE_SCENE_CHIP_IDS.splitBill, label: copy.splitBill },
        { id: PHASE_SCENE_CHIP_IDS.leaveTip, label: copy.leaveTip },
      ];
    case "closed":
      return [];
    default:
      return resolveTableActionChips({
        phase: input.phase,
        hasUnpaidOrders: input.hasUnpaidOrders ?? false,
      }).map((chip) => ({
        id: chip.id,
        label: chip.labelKey,
      }));
  }
}

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
