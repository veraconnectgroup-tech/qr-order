import type { AiGuestOrder } from "@/lib/ai/order-context";
import { guestTextFromTimeline } from "@/lib/denis/cognition/conversation/guest-continuity";
import type { SessionTrajectory } from "@/lib/denis/cognition/intervention/fold-session-trajectory";
import type { GuestMentalModel } from "@/lib/denis/cognition/mental-model/mental-model-types";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";
import type { GuestMemoryProjection } from "@/lib/denis/platform/guest-memory-types";
import type { TablePartyModel } from "@/lib/denis/venue/party/types";
import {
  isGuestRoundMessage,
  isGuestReorderMessage,
} from "@/lib/denis/cognition/tde/semantic-intent-router";
import type { AiCatalogProduct } from "@/lib/ai/catalog/catalog-types";
export type ReorderCandidate = {
  orderId: string;
  items: {
    productId: string;
    productName: string;
    quantity: number;
  }[];
  eligibility: "eligible" | "partial" | "ineligible";
  unavailableItems: string[];
  suggestedAt: number;
};

export type ReorderTrigger =
  | "drink_empty_estimate"
  | "guest_request"
  | "returning_guest"
  | "group_round";

export const DRINK_EMPTY_BEER_MINUTES = 15;
export const DRINK_EMPTY_COCKTAIL_MINUTES = 25;

export function isReorderRequestMessage(message: string): boolean {
  return isGuestReorderMessage(message.trim());
}

export function isGroupRoundRequestMessage(message: string): boolean {
  return isGuestRoundMessage(message.trim());
}

export function drinkEmptyThresholdMinutes(
  productName: string,
  catalogProduct?: Pick<AiCatalogProduct, "drinkFamily" | "menuSection"> | null
): number {
  const family = catalogProduct?.drinkFamily?.toLowerCase() ?? "";
  if (
    family === "cocktail" ||
    family === "spirit" ||
    family === "wine_red" ||
    family === "wine_white"
  ) {
    return DRINK_EMPTY_COCKTAIL_MINUTES;
  }
  if (catalogProduct?.menuSection === "drinks") {
    return DRINK_EMPTY_BEER_MINUTES;
  }
  return DRINK_EMPTY_BEER_MINUTES;
}

export function buildDrinkEmptyNudgeMessage(
  productName: string,
  language?: string
): string {
  const lang = (language ?? "sr").toLowerCase().slice(0, 2);
  if (lang === "de") return `Noch ein ${productName}?`;
  if (lang === "en") return `Another ${productName}?`;
  return `Još jedno ${productName}?`;
}

export function reorderNudgeQuickReplyLabels(language: string): {
  sameAgain: string;
  somethingElse: string;
} {
  const lang = language.toLowerCase().slice(0, 2);
  if (lang === "de") {
    return { sameAgain: "Ja, dasselbe", somethingElse: "Etwas anderes" };
  }
  if (lang === "en") {
    return { sameAgain: "Yes, same", somethingElse: "Something else" };
  }
  return { sameAgain: "Da, isto", somethingElse: "Nešto drugo" };
}

export const REORDER_NUDGE_PREFIX = "reorder_nudge:";

export function reorderNudgeKey(productId: string): string {
  return `${REORDER_NUDGE_PREFIX}${productId}`;
}

export function isReorderNudgeKey(key: string): boolean {
  return key.startsWith(REORDER_NUDGE_PREFIX);
}

const GUEST_ACTIVE_MS = 30 * 60 * 1000;

function isDrinkSection(section: string | null | undefined): boolean {
  return section === "drinks";
}

function minutesSince(iso: string, now: number): number {
  return (now - new Date(iso).getTime()) / 60_000;
}

function deliveredReference(order: AiGuestOrder): string {
  return order.delivered_at ?? order.created_at;
}

function buildCandidate(input: {
  orderId: string;
  items: ReorderCandidate["items"];
  unavailableProductIds: string[];
  now: number;
}): ReorderCandidate | null {
  if (input.items.length === 0) return null;

  const unavailableItems = input.items
    .filter((item) => input.unavailableProductIds.includes(item.productId))
    .map((item) => item.productName);

  const availableItems = input.items.filter(
    (item) => !input.unavailableProductIds.includes(item.productId)
  );

  if (availableItems.length === 0) {
    return {
      orderId: input.orderId,
      items: input.items,
      eligibility: "ineligible",
      unavailableItems,
      suggestedAt: input.now,
    };
  }

  return {
    orderId: input.orderId,
    items: availableItems,
    eligibility:
      unavailableItems.length > 0 ? "partial" : "eligible",
    unavailableItems,
    suggestedAt: input.now,
  };
}

function nudgedProductIds(keys: string[]): Set<string> {
  const ids = new Set<string>();
  for (const key of keys) {
    if (!isReorderNudgeKey(key)) continue;
    ids.add(key.slice(REORDER_NUDGE_PREFIX.length));
  }
  return ids;
}

function filterNudgedItems(
  items: ReorderCandidate["items"],
  nudged: Set<string>
): ReorderCandidate["items"] {
  return items.filter((item) => !nudged.has(item.productId));
}

function guestRequestedReorder(timeline: DenisTimelineRow[]): boolean {
  for (let i = timeline.length - 1; i >= 0; i -= 1) {
    const text = guestTextFromTimeline(timeline[i]!);
    if (!text?.trim()) continue;
    if (isReorderRequestMessage(text)) return true;
  }
  return false;
}

function guestIsActive(input: {
  mental: GuestMentalModel;
  trajectory: SessionTrajectory;
  timeline: DenisTimelineRow[];
  now: number;
}): boolean {
  if (
    input.mental.engagement.guestTurns > 0 &&
    (input.trajectory.engagement === "hot" ||
      input.trajectory.engagement === "warm")
  ) {
    return true;
  }

  for (let i = input.timeline.length - 1; i >= 0; i -= 1) {
    const text = guestTextFromTimeline(input.timeline[i]!);
    if (!text?.trim()) continue;
    const ageMs = input.now - new Date(input.timeline[i]!.created_at).getTime();
    return ageMs <= GUEST_ACTIVE_MS;
  }

  return input.mental.intent !== "finishing" && input.mental.intent !== "paying";
}

function detectDrinkEmptyEstimate(input: {
  orders: AiGuestOrder[];
  mental: GuestMentalModel;
  trajectory: SessionTrajectory;
  timeline: DenisTimelineRow[];
  unavailableProductIds: string[];
  nudged: Set<string>;
  now: number;
}): { trigger: ReorderTrigger; candidate: ReorderCandidate } | null {
  const deliveredDrinks = input.orders
    .filter((order) => order.status === "delivered")
    .filter((order) =>
      order.order_items.some((item) => isDrinkSection(item.menu_section))
    )
    .sort(
      (a, b) =>
        new Date(deliveredReference(b)).getTime() -
        new Date(deliveredReference(a)).getTime()
    );

  const latest = deliveredDrinks[0];
  if (!latest) return null;

  const mins = minutesSince(deliveredReference(latest), input.now);
  const primaryDrink = latest.order_items.find((item) =>
    isDrinkSection(item.menu_section)
  );
  const threshold = drinkEmptyThresholdMinutes(
    primaryDrink?.product_name ?? "pivo"
  );
  if (mins < threshold) return null;
  if (
    !guestIsActive({
      mental: input.mental,
      trajectory: input.trajectory,
      timeline: input.timeline,
      now: input.now,
    })
  ) {
    return null;
  }

  const drinkItems = latest.order_items
    .filter((item) => isDrinkSection(item.menu_section))
    .filter((item) => item.product_id?.trim())
    .map((item) => ({
      productId: item.product_id!.trim(),
      productName: item.product_name,
      quantity: item.quantity,
    }));

  const filtered = filterNudgedItems(drinkItems, input.nudged);
  const candidate = buildCandidate({
    orderId: latest.id,
    items: filtered,
    unavailableProductIds: input.unavailableProductIds,
    now: input.now,
  });

  if (!candidate || candidate.eligibility === "ineligible") return null;
  return { trigger: "drink_empty_estimate", candidate };
}

function guestRequestedGroupRound(timeline: DenisTimelineRow[]): boolean {
  for (let i = timeline.length - 1; i >= 0; i -= 1) {
    const text = guestTextFromTimeline(timeline[i]!);
    if (!text?.trim()) continue;
    if (isGroupRoundRequestMessage(text)) return true;
  }
  return false;
}

function buildMemoryReorderItems(
  memory: GuestMemoryProjection
): ReorderCandidate["items"] {
  const favIds = memory.favoriteProductIds ?? [];
  const names = memory.lastVisitItemNames ?? [];

  if (favIds.length) {
    return favIds.slice(0, 4).map((productId, index) => ({
      productId,
      productName: names[index] ?? productId,
      quantity: 1,
    }));
  }

  return names.slice(0, 4).map((name, index) => ({
    productId: `memory-${index}`,
    productName: name,
    quantity: 1,
  }));
}

function detectGroupRound(input: {
  orders: AiGuestOrder[];
  party: TablePartyModel | null | undefined;
  timeline: DenisTimelineRow[];
  unavailableProductIds: string[];
  nudged: Set<string>;
  now: number;
}): { trigger: ReorderTrigger; candidate: ReorderCandidate } | null {
  const party = input.party;
  if (!party || party.activeDeviceCount < 2) return null;
  if (!guestRequestedGroupRound(input.timeline)) return null;

  const drinkCounts = new Map<
    string,
    { productId: string; productName: string; devices: Set<string> }
  >();

  for (const order of input.orders) {
    if (order.status !== "delivered") continue;
    const drinks = order.order_items.filter((item) =>
      isDrinkSection(item.menu_section)
    );
    if (drinks.length !== 1) continue;
    const item = drinks[0]!;
    const productId = item.product_id?.trim();
    if (!productId) continue;
    const existing = drinkCounts.get(productId);
    if (existing) {
      existing.devices.add(order.id);
    } else {
      drinkCounts.set(productId, {
        productId,
        productName: item.product_name,
        devices: new Set([order.id]),
      });
    }
  }

  const partySize = party.activeDeviceCount;
  let best: {
    productId: string;
    productName: string;
    quantity: number;
    orderId: string;
  } | null = null;

  for (const entry of drinkCounts.values()) {
    if (entry.devices.size < partySize) continue;
    if (input.nudged.has(entry.productId)) continue;
    best = {
      productId: entry.productId,
      productName: entry.productName,
      quantity: partySize,
      orderId: input.orders.find((order) => order.status === "delivered")?.id ?? "",
    };
    break;
  }

  if (!best || !best.orderId) return null;

  const candidate = buildCandidate({
    orderId: best.orderId,
    items: [
      {
        productId: best.productId,
        productName: best.productName,
        quantity: best.quantity,
      },
    ],
    unavailableProductIds: input.unavailableProductIds,
    now: input.now,
  });

  if (!candidate || candidate.eligibility === "ineligible") return null;
  return { trigger: "group_round", candidate };
}

function detectReturningGuest(input: {
  orders: AiGuestOrder[];
  memory: GuestMemoryProjection | null | undefined;
  unavailableProductIds: string[];
  nudged: Set<string>;
  now: number;
}): { trigger: ReorderTrigger; candidate: ReorderCandidate } | null {
  const memory = input.memory;
  if (!memory || memory.visitCount < 2) return null;

  const hasDeliveredThisSession = input.orders.some(
    (order) => order.status === "delivered"
  );
  if (hasDeliveredThisSession) return null;

  const items = filterNudgedItems(buildMemoryReorderItems(memory), input.nudged);
  if (!items.length) return null;

  const candidate = buildCandidate({
    orderId: "return-guest-memory",
    items,
    unavailableProductIds: input.unavailableProductIds,
    now: input.now,
  });
  if (!candidate || candidate.eligibility === "ineligible") return null;
  return { trigger: "returning_guest", candidate };
}

function detectGuestRequest(input: {
  orders: AiGuestOrder[];
  timeline: DenisTimelineRow[];
  unavailableProductIds: string[];
  nudged: Set<string>;
  now: number;
}): { trigger: ReorderTrigger; candidate: ReorderCandidate } | null {
  if (!guestRequestedReorder(input.timeline)) return null;

  const latest = [...input.orders]
    .filter((order) => order.status === "delivered")
    .sort(
      (a, b) =>
        new Date(deliveredReference(b)).getTime() -
        new Date(deliveredReference(a)).getTime()
    )[0];
  if (!latest) return null;

  const items = latest.order_items
    .filter((item) => item.product_id?.trim())
    .map((item) => ({
      productId: item.product_id!.trim(),
      productName: item.product_name,
      quantity: item.quantity,
    }));

  const filtered = filterNudgedItems(items, input.nudged);
  const candidate = buildCandidate({
    orderId: latest.id,
    items: filtered,
    unavailableProductIds: input.unavailableProductIds,
    now: input.now,
  });
  if (!candidate || candidate.eligibility === "ineligible") return null;
  return { trigger: "guest_request", candidate };
}

/** P1 — detect proactive or guest-initiated reorder opportunity. */
export function detectReorderOpportunity(input: {
  orders: AiGuestOrder[];
  mental: GuestMentalModel;
  trajectory: SessionTrajectory;
  memory?: GuestMemoryProjection | null;
  party?: TablePartyModel | null;
  timeline?: DenisTimelineRow[];
  unavailableProductIds?: string[];
  dismissedNudgeKeys?: string[];
  emittedNudgeKeys?: string[];
  now?: number;
}): { trigger: ReorderTrigger; candidate: ReorderCandidate } | null {
  const now = input.now ?? Date.now();
  const timeline = input.timeline ?? [];
  const unavailableProductIds = input.unavailableProductIds ?? [];
  const nudged = nudgedProductIds([
    ...(input.dismissedNudgeKeys ?? []),
    ...(input.emittedNudgeKeys ?? []),
  ]);

  const groupRound = detectGroupRound({
    orders: input.orders,
    party: input.party,
    timeline,
    unavailableProductIds,
    nudged,
    now,
  });
  if (groupRound) return groupRound;

  const guestRequest = detectGuestRequest({
    orders: input.orders,
    timeline,
    unavailableProductIds,
    nudged,
    now,
  });
  if (guestRequest) return guestRequest;

  const drinkEmpty = detectDrinkEmptyEstimate({
    orders: input.orders,
    mental: input.mental,
    trajectory: input.trajectory,
    timeline,
    unavailableProductIds,
    nudged,
    now,
  });
  if (drinkEmpty) return drinkEmpty;

  return detectReturningGuest({
    orders: input.orders,
    memory: input.memory,
    unavailableProductIds,
    nudged,
    now,
  });
}

export function formatReorderItemsLabel(
  items: ReorderCandidate["items"]
): string {
  return items
    .map((item) => `${item.quantity}× ${item.productName}`)
    .join(", ");
}

export function buildReorderDockHeadline(
  items: ReorderCandidate["items"],
  language?: string
): string {
  const label = formatReorderItemsLabel(items);
  const lang = (language ?? "sr").toLowerCase().slice(0, 2);
  if (lang === "de") return `🔄 Noch eine Runde? (${label})`;
  if (lang === "en") return `🔄 Another round? (${label})`;
  return `🔄 Još jedna runda? (${label})`;
}

export function reorderDockActionLabels(language?: string): {
  confirm: string;
  modify: string;
} {
  const lang = (language ?? "sr").toLowerCase().slice(0, 2);
  if (lang === "de") return { confirm: "Ja, gleich", modify: "Anpassen" };
  if (lang === "en") return { confirm: "Yes, same", modify: "Modify" };
  return { confirm: "Da, isto", modify: "Izmijeni" };
}

export const REORDER_CHIP_IDS = {
  confirm: "chip-reorder-confirm",
  modify: "chip-reorder-modify",
} as const;
