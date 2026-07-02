import type { GuestMemoryProjection } from "@/lib/denis/platform/guest-memory-types";
import {
  buildSameAgainChipLabel,
  returnGuestHasPastOrders,
  shouldSuppressAllergyPromptChip,
} from "@/lib/denis/platform/returning-guest";
import type { GuestMentalModel } from "@/lib/denis/cognition/mental-model/mental-model-types";
import type { CartView } from "@/lib/denis/loop/view-types";
import type { SceneSituation, SessionPhase } from "@/lib/scene/types";
import { TABLE_ACTION_CHIP_IDS } from "@/lib/scene/resolve-table-actions";
import { isPaidPaymentStatus } from "@/lib/orders/payment-status";

export const CONTEXTUAL_CHIP_IDS = {
  recommend: "chip-recommend",
  popular: "chip-popular",
  allergy: "chip-allergy",
  placeOrder: "chip-place-order",
  addDrink: "chip-add-drink",
  changeOrder: "chip-change-order",
  orderStatus: "chip-order-status",
  addDrinkWaiting: "chip-add-drink-wait",
  allOk: "chip-all-ok",
  needSomething: "chip-need-something",
  sameAgain: "chip-same-again",
  somethingNew: "chip-something-new",
} as const;

export type ContextualChip = { id: string; label: string };

const MAX_CHIPS = 4;
const MAX_LABEL_LEN = 20;

function clipLabel(label: string): string {
  const trimmed = label.trim();
  if (trimmed.length <= MAX_LABEL_LEN) return trimmed;
  return trimmed.slice(0, MAX_LABEL_LEN).trimEnd();
}

function labelsForLanguage(language: string): Record<
  keyof typeof CONTEXTUAL_CHIP_IDS,
  string
> {
  const lang = language.toLowerCase().slice(0, 2);
  if (lang === "de") {
    return {
      recommend: "Empfehlung",
      popular: "Beliebt heute",
      allergy: "Allergie",
      placeOrder: "Bestellen",
      addDrink: "Getränk",
      changeOrder: "Ändern",
      orderStatus: "Wie lange?",
      addDrinkWaiting: "Drink warten",
      allOk: "Alles ok!",
      needSomething: "Brauche was",
      sameAgain: "Gleich nochmal",
      somethingNew: "Was Neues",
    };
  }
  if (lang === "en") {
    return {
      recommend: "Recommend",
      popular: "Popular today",
      allergy: "I have allergy",
      placeOrder: "Place order",
      addDrink: "Add a drink",
      changeOrder: "Change order",
      orderStatus: "How much longer?",
      addDrinkWaiting: "Drink while wait",
      allOk: "All good!",
      needSomething: "Need something",
      sameAgain: "Same again",
      somethingNew: "Something new",
    };
  }
  if (lang === "fr") {
    return {
      recommend: "Recommander",
      popular: "Populaire",
      allergy: "Allergie",
      placeOrder: "Commander",
      addDrink: "Boisson",
      changeOrder: "Modifier",
      orderStatus: "Combien?",
      addDrinkWaiting: "Boire en attendant",
      allOk: "Tout va bien",
      needSomething: "Besoin de qqch",
      sameAgain: "Encore pareil",
      somethingNew: "Autre chose",
    };
  }
  if (lang === "es") {
    return {
      recommend: "Recomienda",
      popular: "Popular hoy",
      allergy: "Alergia",
      placeOrder: "Pedir",
      addDrink: "Bebida",
      changeOrder: "Cambiar",
      orderStatus: "¿Cuánto falta?",
      addDrinkWaiting: "Beber mientras",
      allOk: "Todo bien",
      needSomething: "Necesito algo",
      sameAgain: "Lo mismo",
      somethingNew: "Algo nuevo",
    };
  }
  if (lang === "it") {
    return {
      recommend: "Consiglia",
      popular: "Popolare",
      allergy: "Allergia",
      placeOrder: "Ordina",
      addDrink: "Bevanda",
      changeOrder: "Modifica",
      orderStatus: "Quanto manca?",
      addDrinkWaiting: "Bevi in attesa",
      allOk: "Tutto ok",
      needSomething: "Mi serve",
      sameAgain: "Di nuovo",
      somethingNew: "Qualcosa nuovo",
    };
  }
  if (lang === "tr") {
    return {
      recommend: "Öner",
      popular: "Popüler",
      allergy: "Alerji",
      placeOrder: "Sipariş",
      addDrink: "İçecek",
      changeOrder: "Değiştir",
      orderStatus: "Ne kadar?",
      addDrinkWaiting: "Beklerken iç",
      allOk: "Her şey ok",
      needSomething: "Bir şey lazım",
      sameAgain: "Yine aynı",
      somethingNew: "Yeni bir şey",
    };
  }
  if (lang === "hr") {
    return {
      recommend: "Preporuči",
      popular: "Popularno",
      allergy: "Alergija",
      placeOrder: "Naruči",
      addDrink: "Piće",
      changeOrder: "Promijeni",
      orderStatus: "Koliko još?",
      addDrinkWaiting: "Piće dok čekam",
      allOk: "Sve OK",
      needSomething: "Treba mi",
      sameAgain: "Opet isto",
      somethingNew: "Nešto novo",
    };
  }
  return {
    recommend: "Preporuči nešto",
    popular: "Popularno danas",
    allergy: "Imam alergiju",
    placeOrder: "Naruči",
    addDrink: "Dodaj piće",
    changeOrder: "Promijeni",
    orderStatus: "Koliko još?",
    addDrinkWaiting: "Piće dok čekam",
    allOk: "Sve OK!",
    needSomething: "Treba mi nešto",
    sameAgain: "Ponovo isto",
    somethingNew: "Nešto novo",
  };
}

function chip(id: string, label: string): ContextualChip {
  return { id, label: clipLabel(label) };
}

export function isReturningGuest(
  memory: GuestMemoryProjection | null | undefined
): boolean {
  return (memory?.visitCount ?? 0) >= 2;
}

/** Favourite product IDs for same-again chip (J2). */
export function resolveSameAgainProductIds(
  memory: GuestMemoryProjection | null | undefined
): string[] {
  if (!isReturningGuest(memory)) return [];
  return (memory?.favoriteProductIds ?? []).filter(Boolean).slice(0, 6);
}

function hasActiveOrders(orders: Array<{ status: string }>): boolean {
  return orders.some(
    (order) => order.status !== "delivered" && order.status !== "cancelled"
  );
}

function allOrdersDelivered(orders: Array<{ status: string }>): boolean {
  return orders.length > 0 && orders.every((order) => order.status === "delivered");
}

function dedupeChips(chips: ContextualChip[]): ContextualChip[] {
  const seen = new Set<string>();
  const out: ContextualChip[] = [];
  for (const entry of chips) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    out.push(entry);
  }
  return out;
}

/**
 * J2 — contextual scene chips from mental model, cart, memory, and phase.
 * Max 4 chips, labels max 20 characters.
 */
export function deriveContextualChips(input: {
  mental: GuestMentalModel;
  phase: SessionPhase;
  cart: CartView;
  memory: GuestMemoryProjection | null;
  language: string;
  situation: SceneSituation | null;
  hasUnpaidOrders: boolean;
  orderCount: number;
}): ContextualChip[] {
  const labels = labelsForLanguage(input.language);
  const chips: ContextualChip[] = [];
  const cartHasItems = input.cart.visibleItemCount > 0;
  const returning = isReturningGuest(input.memory);
  const hasPastOrders = returnGuestHasPastOrders(input.memory);
  const suppressAllergyChip = shouldSuppressAllergyPromptChip(input.memory);

  if (returning && hasPastOrders && input.orderCount === 0 && !cartHasItems) {
    const topItem =
      input.memory?.favoriteItems?.[0] ??
      input.memory?.lastVisitItemNames?.[0] ??
      null;
    chips.push(
      chip(
        CONTEXTUAL_CHIP_IDS.sameAgain,
        buildSameAgainChipLabel(input.language, topItem)
      ),
      chip(CONTEXTUAL_CHIP_IDS.somethingNew, labels.somethingNew)
    );
  }

  if (
    input.orderCount === 0 &&
    !cartHasItems &&
    (input.phase === "browsing" ||
      input.phase === "latent" ||
      input.mental.intent === "arrived" ||
      input.mental.intent === "exploring")
  ) {
    const browseChips = [
      chip(CONTEXTUAL_CHIP_IDS.recommend, labels.recommend),
      chip(CONTEXTUAL_CHIP_IDS.popular, labels.popular),
    ];
    if (!suppressAllergyChip) {
      browseChips.push(chip(CONTEXTUAL_CHIP_IDS.allergy, labels.allergy));
    }
    chips.push(...browseChips);
  } else if (
    cartHasItems &&
    (input.phase === "ordering" ||
      input.phase === "browsing" ||
      input.mental.intent === "ordering" ||
      input.mental.intent === "decided")
  ) {
    chips.push(
      chip(CONTEXTUAL_CHIP_IDS.placeOrder, labels.placeOrder),
      chip(CONTEXTUAL_CHIP_IDS.addDrink, labels.addDrink),
      chip(CONTEXTUAL_CHIP_IDS.changeOrder, labels.changeOrder)
    );
  } else if (
    input.phase === "waiting" ||
    input.mental.intent === "waiting_food" ||
    input.situation?.hasActiveKitchen
  ) {
    chips.push(
      chip(CONTEXTUAL_CHIP_IDS.orderStatus, labels.orderStatus),
      chip(CONTEXTUAL_CHIP_IDS.addDrinkWaiting, labels.addDrinkWaiting)
    );
  } else if (
    allOrdersDelivered(
      input.situation?.orders.map((order) => ({ status: order.status })) ?? []
    ) ||
    input.mental.mealStage === "post_meal" ||
    input.phase === "settling"
  ) {
    chips.push(
      chip(CONTEXTUAL_CHIP_IDS.allOk, labels.allOk),
      chip(CONTEXTUAL_CHIP_IDS.needSomething, labels.needSomething)
    );
    if (input.hasUnpaidOrders) {
      chips.push(
        chip(TABLE_ACTION_CHIP_IDS.viewBill, labels.placeOrder === "Naruči" ? "Račun" : "Bill")
      );
    }
  }

  if (
    input.hasUnpaidOrders &&
    !chips.some((entry) => entry.id === TABLE_ACTION_CHIP_IDS.viewBill)
  ) {
    const billLabel =
      input.language.toLowerCase().startsWith("de")
        ? "Rechnung"
        : input.language.toLowerCase().startsWith("en")
          ? "View bill"
          : "Račun";
    chips.push(chip(TABLE_ACTION_CHIP_IDS.viewBill, billLabel));
  }

  if (
    input.phase !== "closed" &&
    input.orderCount > 0 &&
    hasActiveOrders(
      input.situation?.orders.map((order) => ({ status: order.status })) ?? []
    ) &&
    !chips.some((entry) => entry.id === TABLE_ACTION_CHIP_IDS.orderMore)
  ) {
    const orderMoreLabel =
      input.language.toLowerCase().startsWith("de")
        ? "Mehr bestellen"
        : input.language.toLowerCase().startsWith("en")
          ? "Order more"
          : "Još nešto";
    chips.push(chip(TABLE_ACTION_CHIP_IDS.orderMore, orderMoreLabel));
  }

  if (
    input.hasUnpaidOrders &&
    input.situation?.orders.some(
      (order) =>
        order.status === "delivered" && !isPaidPaymentStatus(order.paymentStatus)
    )
  ) {
    // settling with unpaid delivered orders — bill chip already handled
  }

  return dedupeChips(chips).slice(0, MAX_CHIPS);
}
