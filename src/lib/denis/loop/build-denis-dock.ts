import { delayThresholdMinutes } from "@/lib/denis/cognition/proactive/triggers";
import { foldSessionTrajectory } from "@/lib/denis/cognition/intervention/fold-session-trajectory";
import {
  buildDrinkEmptyNudgeMessage,
  buildReorderDockHeadline,
  detectReorderOpportunity,
  REORDER_CHIP_IDS,
  reorderDockActionLabels,
} from "@/lib/denis/cognition/reorder/reorder-intelligence";
import { isCommerceCapabilityActive } from "@/lib/commerce/policy/resolve-commerce-capability";
import {
  CONTEXTUAL_CHIP_IDS,
} from "@/lib/denis/loop/derive-contextual-chips";
import { formatWorldOrderItems } from "@/lib/denis/loop/build-world-order-headline";
import { mapOrderFactsToAiGuestOrders } from "@/lib/guest/execute-guest-reorder";
import type { FoldMeta, OrderFact, TableSessionState } from "@/lib/denis/loop/types";
import type {
  DenisDock,
  DenisDockChip,
  DenisDockUrgency,
  DenisReorderOffer,
} from "@/lib/denis/loop/view-types";
import {
  buildPartyDockHeadline,
  derivePartyIntelligence,
} from "@/lib/denis/venue/party/derive-party-intelligence";
import { sessionHasUnpaidOrders } from "@/lib/denis/loop/derive-fold-phase";
import { TABLE_ACTION_CHIP_IDS } from "@/lib/scene/resolve-table-actions";
import type { SceneSituation, SessionPhase } from "@/lib/scene/types";
import { isPaidPaymentStatus } from "@/lib/orders/payment-status";

type DockLang = "sr" | "de" | "en";

const TERMINAL_STATUSES = ["delivered", "cancelled", "rejected"] as const;
const PREPARING_STATUSES = [
  "preparing",
  "accepted",
  "confirmed",
  "pending",
  "pending_approval",
] as const;
const OPEN_KITCHEN_STATUSES = [
  "pending",
  "confirmed",
  "accepted",
  "preparing",
  "ready",
] as const;

function isTerminalStatus(status: string): boolean {
  return (TERMINAL_STATUSES as readonly string[]).includes(status);
}

function isPreparingStatus(status: string): boolean {
  return (PREPARING_STATUSES as readonly string[]).includes(status);
}

function isOpenKitchenStatus(status: string): boolean {
  return (OPEN_KITCHEN_STATUSES as readonly string[]).includes(status);
}

function resolveDockLang(language?: string): DockLang {
  const lang = (language ?? "sr").toLowerCase().slice(0, 2);
  if (lang === "de") return "de";
  if (lang === "en") return "en";
  return "sr";
}

function minutesAgo(iso: string, nowMs: number): number {
  return (nowMs - new Date(iso).getTime()) / 60_000;
}

function orderItemsLabel(order: OrderFact): string {
  const label = formatWorldOrderItems(
    order.items.map((item) => ({
      productName: item.productName,
      quantity: item.quantity,
    }))
  );
  if (label) return label;
  if (order.orderNumber != null && order.orderNumber > 0) {
    return `#${order.orderNumber}`;
  }
  return "";
}

function joinItemLabels(orders: OrderFact[]): string {
  return orders
    .map(orderItemsLabel)
    .filter((label) => label.length > 0)
    .join(", ");
}

function isLateOrder(order: OrderFact, nowMs: number): boolean {
  if (!isPreparingStatus(order.status)) return false;
  const waitMinutes = minutesAgo(order.createdAt, nowMs);
  const threshold = delayThresholdMinutes(
    {
      status: order.status,
      created_at: order.createdAt,
      delivered_at: null,
      estimated_prep_minutes: order.estimatedPrepMinutes,
      prep_estimate_confidence: order.prepEstimateConfidence ?? "none",
      order_items: [],
    },
    20
  );
  return waitMinutes >= threshold;
}

function unpaidBillCents(orders: OrderFact[]): number | null {
  let total = 0;
  let hasAmount = false;
  for (const order of orders) {
    if (isPaidPaymentStatus(order.paymentStatus)) continue;
    for (const item of order.items) {
      if (item.lineTotalCents != null) {
        total += item.lineTotalCents;
        hasAmount = true;
      }
    }
  }
  return hasAmount ? total : null;
}

function formatMoney(cents: number, lang: DockLang): string {
  const amount = (cents / 100).toFixed(2);
  if (lang === "de") return `${amount} €`;
  if (lang === "en") return `€${amount}`;
  return `${amount} €`;
}

type DockCopy = {
  browse: string;
  pending: string;
  preparing: (items: string, eta: number) => string;
  ready: (items: string) => string;
  delivered: string;
  late: (items: string) => string;
  settling: (amount: string | null) => string;
  readySubline: (items: string) => string;
  recommend: string;
  callWaiter: string;
  placeOrder: string;
  clearCart: string;
  addDrink: string;
  orderStatus: string;
  dessert: string;
  anotherDrink: string;
  viewBill: string;
  payCard: string;
};

function dockCopy(lang: DockLang): DockCopy {
  if (lang === "de") {
    return {
      browse: "Menü ansehen — tippen für Hilfe",
      pending: "Bestellung gesendet ✓",
      preparing: (items, eta) => `🔥 ${items} werden zubereitet ~${eta} min`,
      ready: (items) => `🔔 ${items} fertig!`,
      delivered: "Guten Appetit! Brauchen Sie noch etwas?",
      late: (items) => `⏳ Danke für Ihre Geduld — ${items} kommen bald`,
      settling: (amount) =>
        amount
          ? `Rechnung: ${amount} — hier zahlen oder Kellner rufen`
          : "Rechnung — hier zahlen oder Kellner rufen",
      readySubline: (items) => `${items} bereit zur Abholung`,
      recommend: "Empfehlung",
      callWaiter: "Kellner rufen",
      placeOrder: "Bestellen",
      clearCart: "Warenkorb leeren",
      addDrink: "Getränk",
      orderStatus: "Wie lange noch?",
      dessert: "Dessert?",
      anotherDrink: "Noch ein Drink",
      viewBill: "Rechnung",
      payCard: "Mit Karte zahlen",
    };
  }
  if (lang === "en") {
    return {
      browse: "Browse the menu — tap for help",
      pending: "Order sent ✓",
      preparing: (items, eta) => `🔥 ${items} preparing ~${eta} min`,
      ready: (items) => `🔔 ${items} ready!`,
      delivered: "Enjoy! Need anything else?",
      late: (items) => `⏳ Thanks for waiting — ${items} arriving soon`,
      settling: (amount) =>
        amount
          ? `Bill: ${amount} — pay here or call your waiter`
          : "Bill ready — pay here or call your waiter",
      readySubline: (items) => `${items} ready for pickup`,
      recommend: "Recommend me",
      callWaiter: "Call waiter",
      placeOrder: "Place order",
      clearCart: "Clear cart",
      addDrink: "Add a drink",
      orderStatus: "Where's my order?",
      dessert: "Dessert?",
      anotherDrink: "Another drink",
      viewBill: "View bill",
      payCard: "Pay by card",
    };
  }
  return {
    browse: "Pregledajte meni — kliknite za pomoć",
    pending: "Narudžba poslana ✓",
    preparing: (items, eta) => `🔥 ${items} se pripremaju ~${eta} min`,
    ready: (items) => `🔔 ${items} spremni!`,
    delivered: "Prijatno! Trebate li još nešto?",
    late: (items) => `⏳ Hvala na strpljenju — ${items} stižu uskoro`,
    settling: (amount) =>
      amount
        ? `Račun: ${amount} — platite ovdje ili pozovite konobara`
        : "Račun — platite ovdje ili pozovite konobara",
    readySubline: (items) => `${items} spremno za pickup`,
    recommend: "Preporuči mi",
    callWaiter: "Pozovi konobara",
    placeOrder: "Naruči",
    clearCart: "Obriši korpu",
    addDrink: "Dodaj piće",
    orderStatus: "Gdje je narudžba?",
    dessert: "Desert?",
    anotherDrink: "Još jedno piće",
    viewBill: "Račun",
    payCard: "Plati karticom",
  };
}

function resolveDockEtaMinutes(orders: OrderFact[]): number {
  const etas = orders
    .map((order) => order.estimatedPrepMinutes)
    .filter((eta): eta is number => eta != null && eta > 0);
  if (!etas.length) return 10;
  return Math.max(...etas);
}

function buildDockHeadline(input: {
  phase: SessionPhase;
  orders: OrderFact[];
  copy: DockCopy;
  lang: DockLang;
  nowMs: number;
  partyHeadline: string | null;
}): { headline: string; subline: string | null } {
  const open = input.orders.filter((order) => !isTerminalStatus(order.status));

  if (
    input.partyHeadline &&
    (input.phase === "browsing" ||
      input.phase === "ordering" ||
      input.phase === "latent") &&
    open.length === 0
  ) {
    return { headline: input.partyHeadline, subline: null };
  }

  if (input.phase === "settling") {
    const billCents = unpaidBillCents(input.orders);
    const amount =
      billCents != null ? formatMoney(billCents, input.lang) : null;
    return { headline: input.copy.settling(amount), subline: null };
  }

  if (!open.length) {
    const allDelivered =
      input.orders.length > 0 &&
      input.orders.every((order) => order.status === "delivered");
    if (allDelivered) {
      return { headline: input.copy.delivered, subline: null };
    }
    return { headline: input.copy.browse, subline: null };
  }

  const lateOrders = open.filter((order) => isLateOrder(order, input.nowMs));
  if (lateOrders.length) {
    return {
      headline: input.copy.late(joinItemLabels(lateOrders)),
      subline: null,
    };
  }

  const ready = open.filter((order) => order.status === "ready");
  const preparing = open.filter((order) => isPreparingStatus(order.status));

  if (ready.length && preparing.length) {
    const eta = resolveDockEtaMinutes(preparing);
    return {
      headline: input.copy.preparing(joinItemLabels(preparing), eta),
      subline: input.copy.readySubline(joinItemLabels(ready)),
    };
  }

  if (ready.length) {
    return {
      headline: input.copy.ready(joinItemLabels(ready)),
      subline: null,
    };
  }

  if (preparing.some((order) => order.status === "preparing")) {
    const kitchenPreparing = preparing.filter(
      (order) => order.status === "preparing"
    );
    const eta = resolveDockEtaMinutes(kitchenPreparing.length ? kitchenPreparing : preparing);
    return {
      headline: input.copy.preparing(
        joinItemLabels(kitchenPreparing.length ? kitchenPreparing : preparing),
        eta
      ),
      subline: null,
    };
  }

  if (preparing.some((order) => order.status === "pending")) {
    return { headline: input.copy.pending, subline: null };
  }

  return {
    headline: input.copy.preparing(joinItemLabels(preparing), resolveDockEtaMinutes(preparing)),
    subline: null,
  };
}

function deriveDockChips(input: {
  phase: SessionPhase;
  copy: DockCopy;
  hasUnpaidOrders: boolean;
  hasCartItems: boolean;
}): DenisDockChip[] {
  const chips: DenisDockChip[] = [];

  switch (input.phase) {
    case "browsing":
    case "latent":
      chips.push(
        {
          label: input.copy.recommend,
          action: CONTEXTUAL_CHIP_IDS.recommend,
          variant: "primary",
        },
        {
          label: input.copy.callWaiter,
          action: "situation-waiter",
          variant: "secondary",
        }
      );
      break;
    case "ordering":
      chips.push(
        {
          label: input.copy.placeOrder,
          action: CONTEXTUAL_CHIP_IDS.placeOrder,
          variant: "primary",
        },
        {
          label: input.copy.clearCart,
          action: CONTEXTUAL_CHIP_IDS.changeOrder,
          variant: "secondary",
        }
      );
      break;
    case "waiting":
      chips.push(
        {
          label: input.copy.addDrink,
          action: CONTEXTUAL_CHIP_IDS.addDrinkWaiting,
          variant: "primary",
        },
        {
          label: input.copy.callWaiter,
          action: "situation-waiter",
          variant: "secondary",
        },
        {
          label: input.copy.orderStatus,
          action: CONTEXTUAL_CHIP_IDS.orderStatus,
          variant: "alert",
        }
      );
      break;
    case "settling":
      chips.push(
        {
          label: input.copy.payCard,
          action: "pay-online",
          variant: "primary",
        },
        {
          label: input.copy.callWaiter,
          action: "situation-waiter",
          variant: "secondary",
        }
      );
      if (input.hasUnpaidOrders) {
        chips.push({
          label: input.copy.viewBill,
          action: TABLE_ACTION_CHIP_IDS.viewBill,
          variant: "secondary",
        });
      }
      break;
    case "closed":
      break;
    default:
      if (input.hasCartItems) {
        chips.push({
          label: input.copy.placeOrder,
          action: CONTEXTUAL_CHIP_IDS.placeOrder,
          variant: "primary",
        });
      }
      break;
  }

  if (
    input.phase !== "settling" &&
    input.phase !== "waiting" &&
    input.hasUnpaidOrders
  ) {
    chips.push({
      label: input.copy.viewBill,
      action: TABLE_ACTION_CHIP_IDS.viewBill,
      variant: "secondary",
    });
  }

  return chips.slice(0, 4);
}

function resolveReorderOffer(input: {
  state: TableSessionState;
  meta: FoldMeta;
  language: string;
  nowMs: number;
}): DenisReorderOffer | null {
  const cohortKey =
    input.state.session.id || input.state.table.token || "reorder";
  if (
    !isCommerceCapabilityActive({
      capabilityId: "reorder.another_round",
      cohortKey,
    })
  ) {
    return null;
  }

  if (input.meta.phase === "settling" || input.meta.phase === "closed") {
    return null;
  }

  const trajectory = foldSessionTrajectory({
    timeline: input.state.timeline,
    browse: input.state.browse,
    mental: input.state.mental,
    orders: input.state.commerce.orders,
    cartLineCount: input.state.commerce.cart.visibleLines.length,
    timing: input.state.offer?.trace.timing,
    nowMs: input.nowMs,
  });

  const opportunity = detectReorderOpportunity({
    orders: mapOrderFactsToAiGuestOrders(input.state.commerce.orders),
    mental: input.state.mental,
    trajectory,
    memory: input.state.guest,
    party: input.state.party,
    timeline: input.state.timeline,
    unavailableProductIds: input.state.venue.ops.unavailableProductIds,
    dismissedNudgeKeys: input.state.conversation.dismissedNudges,
    now: input.nowMs,
  });

  if (!opportunity) return null;

  const labels = reorderDockActionLabels(input.language);
  const primaryName = opportunity.candidate.items[0]?.productName;
  const headline =
    opportunity.trigger === "drink_empty_estimate" && primaryName
      ? buildDrinkEmptyNudgeMessage(primaryName, input.language)
      : buildReorderDockHeadline(
          opportunity.candidate.items,
          input.language
        );

  return {
    headline,
    orderId: opportunity.candidate.orderId,
    confirmAction: REORDER_CHIP_IDS.confirm,
    modifyAction: REORDER_CHIP_IDS.modify,
    confirmLabel: labels.confirm,
    modifyLabel: labels.modify,
  };
}

function resolveDockUrgency(input: {
  phase: SessionPhase;
  orders: OrderFact[];
  situation: SceneSituation | null;
  nowMs: number;
  hasUnpaidOrders: boolean;
}): DenisDockUrgency {
  if (input.situation?.hasReadyOrder) return "alert";
  if (
    input.orders.some(
      (order) => !isTerminalStatus(order.status) && isLateOrder(order, input.nowMs)
    )
  ) {
    return "alert";
  }
  if (input.phase === "settling" && input.hasUnpaidOrders) return "alert";
  if (
    input.phase === "waiting" ||
    input.phase === "ordering" ||
    input.orders.some((order) => isOpenKitchenStatus(order.status))
  ) {
    return "active";
  }
  return "idle";
}

/** Deterministic guest dock — headline, subline, chips, urgency (D1). */
export function buildDenisDock(input: {
  state: TableSessionState;
  meta: FoldMeta;
  situation: SceneSituation | null;
  language?: string;
  nowMs?: number;
}): DenisDock {
  const lang = resolveDockLang(input.language);
  const copy = dockCopy(lang);
  const nowMs = input.nowMs ?? Date.now();
  const orders = input.state.commerce.orders;
  const hasUnpaidOrders = sessionHasUnpaidOrders(orders);
  const hasCartItems = input.state.commerce.cart.visibleLines.length > 0;

  const partyHeadline = buildPartyDockHeadline(
    derivePartyIntelligence({
      party: input.state.party,
      orders,
    })
  );

  const { headline, subline } = buildDockHeadline({
    phase: input.meta.phase,
    orders,
    copy,
    lang,
    nowMs,
    partyHeadline,
  });

  const reorderOffer = resolveReorderOffer({
    state: input.state,
    meta: input.meta,
    language: input.language ?? "sr",
    nowMs,
  });

  return {
    headline,
    subline,
    chips: deriveDockChips({
      phase: input.meta.phase,
      copy,
      hasUnpaidOrders,
      hasCartItems,
    }),
    urgency: resolveDockUrgency({
      phase: input.meta.phase,
      orders,
      situation: input.situation,
      nowMs,
      hasUnpaidOrders,
    }),
    reorderOffer,
  };
}
