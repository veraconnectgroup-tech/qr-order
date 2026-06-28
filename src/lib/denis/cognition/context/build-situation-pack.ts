import type { BeliefGraph } from "@/lib/denis/cognition/beliefs/belief-types";
import { getBeliefValue } from "@/lib/denis/cognition/beliefs/belief-types";
import { CORE_BELIEF_KEYS } from "@/lib/denis/cognition/beliefs/belief-types";
import { retrieveCommerceEvidence } from "@/lib/denis/cognition/context/retrievers/commerce-evidence";
import { buildConversationEvidence } from "@/lib/denis/cognition/conversation/conversation-evidence";
import { buildDialogueFrameEvidence } from "@/lib/denis/cognition/context/retrievers/dialogue-frame";
import { retrieveGuestIntelEvidence } from "@/lib/denis/cognition/context/retrievers/guest-intel-evidence";
import { retrieveTranscriptWindowEvidence } from "@/lib/denis/cognition/context/retrievers/transcript-window";
import { retrieveVenueOpsEvidence } from "@/lib/denis/cognition/context/retrievers/venue-ops-evidence";
import { retrieveVenueRhythmEvidence } from "@/lib/denis/cognition/context/retrievers/venue-rhythm-evidence";
import {
  buildActiveMemory,
  formatActiveMemoryBlock,
  formatGuestRelationshipActiveMemoryBlock,
} from "@/lib/denis/cognition/conversation/active-memory";
import type { FlowNodeId } from "@/lib/denis/platform/flow-types";
import type { TableSessionState } from "@/lib/denis/loop/types";
import type { GuestMemoryProjection } from "@/lib/denis/platform/guest-memory-types";
import { formatGuestHistoryBlock } from "@/lib/denis/platform/guest-memory-format";
import type { LoyaltyContextInput } from "@/lib/denis/commerce/loyalty/loyalty-context";
import { buildLoyaltyContextBlock } from "@/lib/denis/commerce/loyalty/loyalty-context";
import type { ResolvedRhythmContext } from "@/lib/denis/config/rhythm-prior-types";
import {
  inferSessionPhaseFromCommerce,
  type SessionPhaseOrder,
} from "@/lib/denis/loop/infer-session-phase";
import type { SessionPhase } from "@/lib/scene/types";
import type {
  OpsPlannerEffects,
  VenueOpsBeliefs,
} from "@/lib/denis/venue/ops/types";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";
import {
  estimateRemainingPrepMinutes,
  resolveKitchenBacklogLevel,
  type VenueScheduleSnapshot,
} from "@/lib/denis/cognition/proactive/triggers";
import {
  buildKitchenLoadSnapshot,
  buildVenueKitchenLoad,
  formatKitchenPulseLine,
  suggestBottleneckAlternative,
} from "@/lib/denis/venue/ops/kitchen-load-model";
import {
  buildPartyDockHeadline,
  buildRoundOrderDenisMessage,
  derivePartyIntelligence,
  detectRoundOrderIntent,
} from "@/lib/denis/venue/party/derive-party-intelligence";
import { canCurrentDeviceConfirmOrder } from "@/lib/denis/venue/party/resolve-shared-session";
import { derivePartyDrinkGapFacts } from "@/lib/denis/venue/party/group-drink-dynamics";
import {
  resolveDrinkOccasion,
  suggestDrinksForFood,
  isOccasionAllowed,
} from "@/lib/denis/intelligence/drink-sommelier";
import { classifyDrinkKnowledge } from "@/lib/denis/kernel/vkg/drink-knowledge-graph";
import { formatGuestMentalModelBlock } from "@/lib/denis/cognition/mental-model/mental-model-intelligence";
import { buildScrollIntelligenceSection } from "@/lib/denis/cognition/context/build-scroll-intelligence-section";
import { buildBrowseContextSection } from "@/lib/denis/cognition/context/build-browse-context-section";
import {
  assembleContextLayers,
  createContextLayer,
  inferTurnIntent,
  type ContextLayer,
} from "@/lib/denis/cognition/context/priority-layers";
import type { ContextAwarenessSnapshot } from "@/lib/denis/intelligence/event-context";
import { buildExternalContextSituationBlock } from "@/lib/denis/intelligence/resolve-context-awareness";
import { formatVenueKnowledgeBlock } from "@/lib/denis/cognition/manifest/inject-venue-knowledge";
import type { VenueKnowledgeSnapshot } from "@/lib/denis/platform/venue-knowledge-types";
import { buildSessionExperienceScore } from "@/lib/denis/commerce/session-experience-score";
import { resolveExperienceDenisHint } from "@/lib/commerce/experience/resolve-experience-moment";

type TranscriptMessage = {
  role: "user" | "assistant";
  content: string;
};

export type SituationPackInput = {
  state?: TableSessionState | null;
  beliefs: BeliefGraph;
  sessionPhase?: SessionPhase | null;
  flowNodeId?: FlowNodeId | null;
  transcript?: TranscriptMessage[];
  orderContext?: string | null;
  orderDraftContext?: string | null;
  guestMemory?: GuestMemoryProjection | null;
  loyaltyContext?: LoyaltyContextInput | null;
  venueOps?: VenueOpsBeliefs | null;
  opsEffects?: OpsPlannerEffects | null;
  vkgPairingBlock?: string | null;
  playbookBlock?: string | null;
  rhythm?: ResolvedRhythmContext | null;
  venueSchedule?: VenueScheduleSnapshot | null;
  /** Venue-wide kitchen orders for Kitchen Mind Link pulse (optional). */
  venueKitchenOrders?: Array<{
    id: string;
    status: string;
    createdAt: string;
    deliveredAt?: string | null;
    estimatedPrepMinutes?: number | null;
    prepEstimateConfidence?: string | null;
    items: Array<{
      productId?: string | null;
      productName: string;
      quantity: number;
      menuSection?: string | null;
    }>;
  }> | null;
  /** Adaptive per-turn token budget — enables priority-layer assembly. */
  contextTokenBudget?: number | null;
  guestMessage?: string | null;
  /** Prompt 87 — weather, events, time-of-day, seasonal context. */
  contextAwareness?: ContextAwarenessSnapshot | null;
  /** L2 per-venue knowledge accumulation (GDPR-safe aggregates). */
  venueKnowledge?: VenueKnowledgeSnapshot | null;
};

function buildProcessSection(input: SituationPackInput): string {
  const phase =
    input.sessionPhase ??
    inferPhaseFromState(input.state) ??
    "browsing";
  const flowNode =
    input.flowNodeId ?? input.state?.conversation?.flowNodeId ?? "welcome";

  const lines = [
    "PROCESS:",
    `- session.phase: ${phase}`,
    `- flow_node: ${flowNode}`,
  ];

  const session = input.state?.session;
  if (session) {
    lines.push(`- session.status: ${session.status}`);
    lines.push(`- bill_settled: ${session.billSettled ? "yes" : "no"}`);
  }

  const table = input.state?.table;
  if (table?.name) {
    lines.push(`- table: ${table.name}`);
  }

  return lines.join("\n");
}

function ordersForPhaseInference(
  state: TableSessionState | null | undefined
): SessionPhaseOrder[] {
  return (state?.commerce.orders ?? []).map((order) => ({
    status: order.status,
    createdAt: order.createdAt,
    deliveredAt: order.deliveredAt,
    items: order.items.map((item) => ({ menuSection: item.menuSection })),
  }));
}

function inferPhaseFromState(
  state: TableSessionState | null | undefined,
  nowMs = Date.now()
): SessionPhase | null {
  if (!state) return null;

  return inferSessionPhaseFromCommerce({
    sessionClosed:
      state.session.status !== "active" ||
      state.session.accessState === "closed" ||
      state.session.accessState === "closing",
    billSettled: state.session.billSettled,
    hasCartActivity: state.commerce.cart.visibleLines.length > 0,
    orders: ordersForPhaseInference(state),
    nowMs,
  });
}

function buildPartySection(
  state: TableSessionState | null | undefined,
  guestMessage?: string | null
): string {
  const party = state?.party;
  if (!party || party.activeDeviceCount <= 0) return "";
  const facts = derivePartyIntelligence({
    party,
    orders: state.commerce.orders.map((order) => ({
      id: order.id,
      status: order.status,
      createdAt: order.createdAt,
      deviceFingerprint: order.deviceFingerprint,
      items: order.items,
    })),
  });

  const peerItems =
    party.partyMode === "shared_cart"
      ? party.devices
          .filter(
            (device) =>
              device.deviceFingerprint !== party.currentDeviceFingerprint &&
              device.manualCartSnapshot &&
              typeof device.manualCartSnapshot === "object" &&
              Array.isArray(
                (device.manualCartSnapshot as { items?: unknown }).items
              ) &&
              ((device.manualCartSnapshot as { items: unknown[] }).items
                .length ?? 0) > 0
          )
          .flatMap((device) => {
            const items = (
              device.manualCartSnapshot as {
                items: Array<{ productName?: string }>;
              }
            ).items;
            return items
              .map((item) => item.productName?.trim())
              .filter(Boolean) as string[];
          })
      : [];

  const lines = [
    "PARTY:",
    facts
      ? `- ${facts.devicesWithOrder}/${facts.partySize} have ordered`
      : null,
    `- Mode: ${party.partyMode}`,
    `- devices_at_table: ${party.activeDeviceCount}`,
    `- current_device_primary: ${party.isCurrentDevicePrimary ? "yes" : "no"}`,
    `- current_device_may_confirm: ${
      canCurrentDeviceConfirmOrder({
        partyMode: party.partyMode,
        isCurrentDevicePrimary: party.isCurrentDevicePrimary,
      })
        ? "yes"
        : "no (secondary waits for primary in shared_cart)"
    }`,
    peerItems.length
      ? `- shared_cart_peer_items: ${[...new Set(peerItems)].join(", ")}`
      : null,
    guestMessage && detectRoundOrderIntent(guestMessage)
      ? `- round_order_intent: yes — ${buildRoundOrderDenisMessage()}`
      : null,
    facts?.isPartyIncompleteForCurrentDevice
      ? "- party_incomplete_for_this_device: yes"
      : null,
  ].filter(Boolean);

  return lines.join("\n");
}

function buildPendingSlotHint(
  state: TableSessionState | null | undefined,
  beliefs: BeliefGraph
): string {
  const pendingSlot = getBeliefValue<string>(
    beliefs,
    CORE_BELIEF_KEYS.commercePendingSlot
  );
  if (!pendingSlot || !state) return "";

  const line = state.commerce.cart.visibleLines.find(
    (item) => !item.serveSize?.trim()
  );
  if (!line) {
    return `PENDING SLOT: awaiting ${pendingSlot} (guest must answer Denis last question)`;
  }

  return [
    "PENDING SLOT:",
    `- ${line.quantity}x ${line.productName} needs ${pendingSlot}`,
    "- Guest reply must fill this via proposedItems — do not re-ask the same question.",
  ].join("\n");
}

function buildPhaseBehaviorSection(input: SituationPackInput): string {
  const phase =
    input.sessionPhase ??
    inferPhaseFromState(input.state) ??
    "browsing";
  const flowNode =
    input.flowNodeId ?? input.state?.conversation?.flowNodeId ?? "welcome";

  const lines = ["PHASE BEHAVIOR (follow this — do not reset thread):"];

  switch (phase) {
    case "browsing":
    case "latent":
      if (
        input.guestMemory &&
        input.guestMemory.visitCount > 1 &&
        input.guestMemory.favoriteItems.length > 0
      ) {
        lines.push(
          `- Return guest (${input.guestMemory.visitCount} visits): welcome back — offer usual (${input.guestMemory.favoriteItems.slice(0, 2).join(", ")}) OR something new.`
        );
      }
      if (flowNode === "welcome") {
        lines.push(
          "- Welcome node: polite greeting (Dobar dan / Guten Tag), how may I help, soft 'have you decided?'. Warm — not pushy, no menu cards."
        );
      } else {
        lines.push(
          "- Guest may browse or start ordering. Polite and helpful; offer drink/food when relevant — never repetitive nudges."
        );
      }
      break;
    case "ordering":
      if (flowNode === "recap" || flowNode === "submit") {
        lines.push(
          "- Recap/confirm phase: guest may confirm (može, da, ajde) or add items. Do not restart welcome."
        );
      } else {
        lines.push(
          "- Active ordering: know the menu — vague category (pivo/beer) → name real items + size in one question. Ask each missing slot ONCE; combine when possible."
        );
      }
      break;
    case "waiting":
      lines.push(
        "- Orders in kitchen: answer status when asked. ETA updates and light drink suggestions OK — no food upsell."
      );
      break;
    case "eating":
      lines.push(
        "- Guest is eating: DO NOT interrupt — respond only when the guest writes."
      );
      lines.push(
        "- No proactive upsell or small talk; dessert nudge only after ~15 min since mains delivered."
      );
      break;
    case "settling":
      lines.push(
        "- Bill/payment phase: help with payment or handoff. Do not ask what they want to drink."
      );
      break;
    case "closed":
      lines.push("- Session closed: brief thanks only.");
      break;
    default:
      break;
  }

  return lines.join("\n");
}

const KITCHEN_OPEN_STATUSES = [
  "pending",
  "accepted",
  "confirmed",
  "preparing",
  "ready",
] as const;

function isKitchenOpenStatus(status: string): boolean {
  return (KITCHEN_OPEN_STATUSES as readonly string[]).includes(status);
}

function buildKitchenSection(input: SituationPackInput, nowMs = Date.now()): string {
  const orders = input.state?.commerce.orders ?? [];
  const kitchenOrders = orders.filter(
    (order) =>
      isKitchenOpenStatus(order.status) &&
      order.items.some(
        (item) =>
          item.menuSection === "food" || item.menuSection === "desserts"
      )
  );

  const ops = input.venueOps;
  const capacity = input.opsEffects?.capacityBanner;
  const kitchenStress = ops?.stationStress?.find(
    (station) => station.station === "kitchen"
  );

  const preliminaryLoad =
    ops?.kitchenLoad ??
    (input.venueKitchenOrders?.length
      ? buildKitchenLoadSnapshot(
          input.venueKitchenOrders.map((order) => ({
            status: order.status,
            order_items: order.items.map((item) => ({
              product_id: item.productId,
              product_name: item.productName,
              menu_section: item.menuSection ?? "food",
              quantity: item.quantity,
            })),
          }))
        )
      : null);

  const hasKitchenMindSignal =
    Boolean(preliminaryLoad?.stations.some((row) => row.queueDepth > 0)) ||
    (input.state?.commerce.cart.visibleLines.length ?? 0) > 0;

  if (
    kitchenOrders.length === 0 &&
    ops?.kdsStress !== "high" &&
    !capacity?.showBanner &&
    (kitchenStress?.activeCount ?? 0) <= 5 &&
    !hasKitchenMindSignal
  ) {
    return "";
  }

  const lines = ["KITCHEN:"];

  const venuePendingCount = Math.max(
    kitchenStress?.activeCount ?? 0,
    kitchenOrders.filter((o) =>
      ["pending", "accepted", "confirmed"].includes(o.status)
    ).length
  );
  const backlogLevel = resolveKitchenBacklogLevel(venuePendingCount);
  lines.push(`- backlog_level: ${backlogLevel}`);
  if (backlogLevel !== "normal") {
    lines.push(
      "- posture: do not push complex dishes — warn guest about kitchen wait"
    );
  }

  if (kitchenOrders.length > 0) {
    const readyCount = kitchenOrders.filter((o) => o.status === "ready").length;
    const preparingCount = kitchenOrders.filter(
      (o) => o.status === "preparing"
    ).length;
    const pendingCount = kitchenOrders.filter((o) =>
      ["pending", "accepted", "confirmed"].includes(o.status)
    ).length;

    lines.push(
      `- table_orders: ${pendingCount} pending, ${preparingCount} preparing, ${readyCount} ready`
    );

    let maxWait = 0;
    let oldestLate: (typeof kitchenOrders)[number] | null = null;

    for (const order of kitchenOrders) {
      const wait = Math.max(
        0,
        Math.floor((nowMs - new Date(order.createdAt).getTime()) / 60_000)
      );
      if (wait > maxWait) maxWait = wait;
      if (
        !oldestLate ||
        new Date(order.createdAt).getTime() <
          new Date(oldestLate.createdAt).getTime()
      ) {
        oldestLate = order;
      }
    }

    if (maxWait > 0) {
      lines.push(`- guest_wait: ${maxWait} min`);
    }

    if (oldestLate?.estimatedPrepMinutes != null) {
      const remaining = estimateRemainingPrepMinutes(
        {
          created_at: oldestLate.createdAt,
          estimated_prep_minutes: oldestLate.estimatedPrepMinutes,
        },
        nowMs
      );
      const late = maxWait > oldestLate.estimatedPrepMinutes;
      lines.push(
        `- eta_remaining: ~${remaining} min${late ? " (LATE — empathy needed)" : ""}`
      );
    }
  }

  if (ops?.kdsStress === "high") {
    lines.push("- venue_kds_stress: high");
  }

  if (kitchenStress) {
    lines.push(
      `- venue_kitchen_queue: ${kitchenStress.activeCount} active, avg ${kitchenStress.avgWaitMinutes ?? "?"} min`
    );
  }

  if (capacity?.showBanner) {
    lines.push(
      `- capacity: ${capacity.level} — ~${capacity.estimatedWaitMinutes} min`
    );
  }

  const kitchenLoad = preliminaryLoad;

  if (kitchenLoad) {
    lines.push(`- ${formatKitchenPulseLine(kitchenLoad)}`);
    if (kitchenLoad.rushStations.length > 0) {
      lines.push(
        `- rush_stations: ${kitchenLoad.rushStations.join(", ")} — prefer quick-prep alternatives`
      );
    }

    const cartLines = input.state?.commerce.cart.visibleLines ?? [];
    for (const line of cartLines) {
      const alt = suggestBottleneckAlternative({
        productName: line.productName,
        productId: line.productId,
        menuSection: line.menuSection,
        load: kitchenLoad,
      });
      if (alt) {
        lines.push(
          `- bottleneck_redirect: ${alt.insteadOf} → ${alt.alternativeName} (~${alt.prepMinutes} min, ${alt.overloadedStation} queue ${alt.queueDepth}) — positive alternative, do not say kitchen is slow`
        );
        break;
      }
    }
  }

  return lines.join("\n");
}

const BAR_OPEN_STATUSES = [
  "pending",
  "accepted",
  "confirmed",
  "preparing",
  "ready",
] as const;

function isBarOpenStatus(status: string): boolean {
  return (BAR_OPEN_STATUSES as readonly string[]).includes(status);
}

function minutesSince(iso: string, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - new Date(iso).getTime()) / 60_000));
}

const BAR_DRINK_NUDGE_KINDS = [
  "drink_refill",
  "drink_with_food",
  "drink_pairing",
  "round_two",
  "happy_hour_upsell",
] as const;

function isBarDrinkNudgeKind(kind: string): boolean {
  return (BAR_DRINK_NUDGE_KINDS as readonly string[]).includes(kind);
}

function countDrinkSuggestionsMade(timeline: DenisTimelineRow[] | undefined): number {
  if (!timeline?.length) return 0;
  let count = 0;
  for (const event of timeline) {
    if (event.event_type !== "proactive.emitted") continue;
    const payload = event.payload;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) continue;
    const kind = (payload as Record<string, unknown>).kind;
    if (typeof kind === "string" && isBarDrinkNudgeKind(kind)) {
      count += 1;
    }
  }
  return count;
}

function formatDeliveredDrinkLabel(
  order: NonNullable<TableSessionState["commerce"]["orders"][number]>
): string {
  const drink = order.items.find((item) => item.menuSection === "drinks");
  return drink?.productName?.trim() || "drink";
}

function buildBarSection(input: SituationPackInput, nowMs = Date.now()): string {
  const orders = input.state?.commerce.orders ?? [];
  const activeDrinkOrders = orders.filter(
    (order) =>
      isBarOpenStatus(order.status) &&
      order.items.some((item) => item.menuSection === "drinks")
  );
  const deliveredDrinks = orders
    .filter(
      (order) =>
        order.status === "delivered" &&
        order.items.some((item) => item.menuSection === "drinks")
    )
    .sort(
      (a, b) =>
        new Date(b.deliveredAt ?? b.createdAt).getTime() -
        new Date(a.deliveredAt ?? a.createdAt).getTime()
    );
  const happyHour = input.venueSchedule?.happyHour === true;
  const drinkSuggestionsMade = countDrinkSuggestionsMade(input.state?.timeline);

  const hasOpenFood = orders.some(
    (order) =>
      ["pending", "accepted", "preparing"].includes(order.status) &&
      order.items.some((item) => item.menuSection === "food")
  );
  const hasSommelierSignal =
    hasOpenFood ||
    activeDrinkOrders.length > 0 ||
    deliveredDrinks.length > 0 ||
    (input.state?.party?.activeDeviceCount ?? 0) >= 2;

  if (
    activeDrinkOrders.length === 0 &&
    deliveredDrinks.length === 0 &&
    !happyHour &&
    drinkSuggestionsMade === 0 &&
    !hasSommelierSignal
  ) {
    return "";
  }

  const lines = ["BAR:"];

  if (activeDrinkOrders.length > 0) {
    lines.push(`active_drink_orders: ${activeDrinkOrders.length}`);
  }

  const latestDelivered = deliveredDrinks[0];
  if (latestDelivered) {
    const deliveredRef = latestDelivered.deliveredAt ?? latestDelivered.createdAt;
    const mins = minutesSince(deliveredRef, nowMs);
    lines.push(
      `last_drink_delivered: ${mins} min ago (${formatDeliveredDrinkLabel(latestDelivered)})`
    );
  }

  if (happyHour) {
    const until = input.venueSchedule?.happyHourUntil?.trim();
    lines.push(
      until ? `happy_hour: true (until ${until})` : "happy_hour: true"
    );
  }

  if (drinkSuggestionsMade > 0) {
    lines.push(`drink_suggestions_made: ${drinkSuggestionsMade}`);
  }

  const hasFoodDelivered = orders.some(
    (order) =>
      order.status === "delivered" &&
      order.items.some((item) => item.menuSection === "food")
  );
  const mealStage =
    input.sessionPhase === "settling" || input.sessionPhase === "closed"
      ? "post_meal"
      : !hasOpenFood && !hasFoodDelivered && activeDrinkOrders.length > 0
        ? "aperitif"
        : hasFoodDelivered || hasOpenFood
          ? "main"
          : "pre_order";

  const occasion = resolveDrinkOccasion({
    mealStage,
    hasFoodDelivered,
    hasOpenFoodOrder: hasOpenFood,
  });
  if (
    occasion &&
    isOccasionAllowed(occasion, mealStage, hasFoodDelivered)
  ) {
    lines.push(`drink_occasion: ${occasion}`);
    if (occasion === "digestif") {
      lines.push("- do NOT suggest digestif before food is delivered");
    }
  }

  const recentFood = orders
    .filter(
      (order) =>
        ["pending", "accepted", "preparing"].includes(order.status) &&
        order.items.some((item) => item.menuSection === "food")
    )
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];
  const foodItem = recentFood?.items.find((item) => item.menuSection === "food");
  if (foodItem?.productName && occasion === "pairing") {
    const pairing = suggestDrinksForFood(foodItem.productName, "pairing");
    if (pairing) {
      lines.push(
        `- sommelier_pairing: ${foodItem.productName} → ${pairing.primary}${pairing.secondary ? ` ili ${pairing.secondary}` : ""}`
      );
    }
  }

  if (latestDelivered) {
    const drinkLabel = formatDeliveredDrinkLabel(latestDelivered);
    const node = classifyDrinkKnowledge(drinkLabel);
    lines.push(`last_drink_family: ${node.family}`);
  }

  const party = input.state?.party;
  if (party && party.activeDeviceCount >= 2) {
    const drinkGap = derivePartyDrinkGapFacts({
      partySize: party.activeDeviceCount,
      orders: orders.map((order) => ({
        id: order.id,
        status: order.status,
        created_at: order.createdAt,
        delivered_at: order.deliveredAt ?? null,
        order_items: order.items.map((item) => ({
          product_id: item.productId ?? null,
          product_name: item.productName,
          unit_price: 0,
          quantity: item.quantity,
          menu_section: (item.menuSection ?? "food") as "food",
        })),
      })),
    });
    if (drinkGap) {
      lines.push(
        `- party_drink_gap: ${drinkGap.devicesWithDrink}/${drinkGap.partySize} have drinks — ask missing guest once`
      );
    }
  }

  return lines.join("\n");
}

function buildAllergySection(beliefs: BeliefGraph): string {
  const allergies = getBeliefValue<string[]>(
    beliefs,
    CORE_BELIEF_KEYS.guestAllergies
  );
  if (!allergies?.length) return "";
  return `ALLERGIES (strict — never contradict):\n- ${allergies.join(", ")}`;
}

function buildExperienceScoreSection(
  state: TableSessionState | null | undefined,
  language?: string | null
): string {
  if (!state?.mental) return "";

  const experience = buildSessionExperienceScore(state);
  const hint = resolveExperienceDenisHint({
    score: experience.overallScore,
    language,
  });

  const lines = [
    "GUEST EXPERIENCE (realtime score — Prompt 78):",
    `- score: ${experience.overallScore.toFixed(1)}/10 (${experience.realtime.band})`,
    `- behavior: ${experience.realtime.behavior}`,
    `- tipping: ${experience.realtime.tippingMode}`,
    `- review: ${experience.realtime.reviewMode}`,
  ];

  if (experience.realtime.staffAlert) {
    lines.push("- staff_alert: low experience — floor should check in");
  }
  if (hint) {
    lines.push(`- denis_hint: ${hint}`);
  }

  return lines.join("\n");
}

function buildRecentTurnsSection(
  transcript: TranscriptMessage[] | undefined,
  activeMemory: ReturnType<typeof buildActiveMemory>
): string {
  if (activeMemory?.rawTail.length) {
    const lines = activeMemory.rawTail.slice(-6).map(
      (entry) => `${entry.role === "guest" ? "Guest" : "Denis"}: ${entry.text}`
    );
    return `RECENT TRANSCRIPT (last ${lines.length} turns):\n${lines.join("\n")}`;
  }
  return retrieveTranscriptWindowEvidence(transcript ?? [], 3);
}

function collectSituationLayers(input: SituationPackInput): ContextLayer[] {
  const layers: ContextLayer[] = [];
  const push = (
    priority: Parameters<typeof createContextLayer>[0],
    id: Parameters<typeof createContextLayer>[1],
    content: string
  ) => {
    const layer = createContextLayer(priority, id, content);
    if (layer) layers.push(layer);
  };

  push("P0", "process", buildProcessSection(input));

  const mentalBlock = formatGuestMentalModelBlock(input.state?.mental);
  push("P0", "guest_mental_model", mentalBlock);

  const dialogueFrame = buildDialogueFrameEvidence({
    beliefs: input.beliefs,
    state: input.state,
    transcript: input.transcript,
  });
  push("P0", "dialogue_frame", dialogueFrame);
  push("P0", "allergies", buildAllergySection(input.beliefs));

  const conversationEvidence = buildConversationEvidence(
    input.state?.conversation?.model
  );
  push("P0", "active_gaps", conversationEvidence);

  const commerce = retrieveCommerceEvidence(
    input.state,
    input.orderContext,
    input.orderDraftContext
  );
  push("P0", "cart", commerce);

  const pendingHint = buildPendingSlotHint(input.state, input.beliefs);
  if (pendingHint && !input.orderDraftContext?.includes("PENDING ORDER ITEM")) {
    push("P0", "active_gaps", pendingHint);
  }

  const activeMemory = input.state?.timeline
    ? buildActiveMemory(
        input.state.timeline,
        undefined,
        Date.now(),
        input.state.conversation?.model?.graph ?? null
      )
    : null;
  push("P1", "active_memory", activeMemory ? formatActiveMemoryBlock(activeMemory) : "");

  const recentTurns = buildRecentTurnsSection(input.transcript, activeMemory);
  if (!conversationEvidence) {
    push("P1", "recent_turns", recentTurns);
  } else {
    push("P3", "full_transcript", recentTurns);
  }

  const menuParts = [input.vkgPairingBlock, input.playbookBlock]
    .filter((part) => part?.trim())
    .join("\n\n");
  push("P1", "menu_context", menuParts);

  push("P2", "party", buildPartySection(input.state, input.guestMessage));
  push("P2", "experience", buildExperienceScoreSection(input.state, input.guestMemory?.preferredLanguage));
  push("P2", "kitchen", buildKitchenSection(input));
  push("P2", "bar", buildBarSection(input));
  push("P2", "scroll", buildScrollIntelligenceSection(input.state?.browse));
  push("P1", "browse_context", buildBrowseContextSection(input.state?.browse));

  const externalContext = buildExternalContextSituationBlock(
    input.contextAwareness
  );
  push("P2", "external_context", externalContext);

  const ops = retrieveVenueOpsEvidence(input.venueOps, input.opsEffects);
  push("P2", "venue_ops", ops);

  push("P3", "guest_intel", retrieveGuestIntelEvidence(input.guestMemory));
  push(
    "P3",
    "guest_intel",
    input.guestMemory
      ? formatGuestRelationshipActiveMemoryBlock(input.guestMemory)
      : ""
  );
  push(
    "P3",
    "guest_intel",
    input.guestMemory ? formatGuestHistoryBlock(input.guestMemory) : ""
  );

  const loyaltyBlock = input.loyaltyContext
    ? buildLoyaltyContextBlock(input.loyaltyContext)
    : input.guestMemory
      ? buildLoyaltyContextBlock({
          visitCount: input.guestMemory.visitCount,
          totalSpent: (input.guestMemory.avgSpendCents ?? 0) / 100,
          pointsBalance: 0,
          lastVisitItemNames: input.guestMemory.lastVisitItemNames,
        })
      : "";
  push("P3", "loyalty", loyaltyBlock);
  push("P3", "analytics", retrieveVenueRhythmEvidence(input.rhythm));
  push("P3", "analytics", formatVenueKnowledgeBlock(input.venueKnowledge));
  push("P0", "phase_behavior", buildPhaseBehaviorSection(input));

  return layers;
}

/**
 * ADR-031 C1 — Unified Situation Pack for every LLM perceive turn.
 * Single truth block: process + dialogue + commerce + transcript + behavior.
 */
export function buildSituationPack(input: SituationPackInput): string {
  const header = "SITUATION PACK (truth — do not contradict):";

  if (input.contextTokenBudget != null && input.contextTokenBudget > 0) {
    const intent = inferTurnIntent(input.guestMessage ?? "");
    const assembled = assembleContextLayers({
      layers: collectSituationLayers(input),
      tokenBudget: input.contextTokenBudget,
      intent,
      guestMessage: input.guestMessage ?? undefined,
    });
    if (!assembled.text.trim()) return header;
    return `${header}\n\n${assembled.text}`;
  }

  const blocks: string[] = [
    header,
    buildProcessSection(input),
    formatGuestMentalModelBlock(input.state?.mental),
    buildDialogueFrameEvidence({
      beliefs: input.beliefs,
      state: input.state,
      transcript: input.transcript,
    }),
  ];

  const conversationEvidence = buildConversationEvidence(
    input.state?.conversation?.model
  );
  if (conversationEvidence) blocks.push(conversationEvidence);

  const commerce = retrieveCommerceEvidence(
    input.state,
    input.orderContext,
    input.orderDraftContext
  );
  if (commerce) blocks.push(commerce);

  const pendingHint = buildPendingSlotHint(input.state, input.beliefs);
  if (pendingHint && !input.orderDraftContext?.includes("PENDING ORDER ITEM")) {
    blocks.push(pendingHint);
  }

  const party = buildPartySection(input.state, input.guestMessage);
  if (party) blocks.push(party);

  const experience = buildExperienceScoreSection(
    input.state,
    input.guestMemory?.preferredLanguage
  );
  if (experience) blocks.push(experience);

  const kitchen = buildKitchenSection(input);
  if (kitchen) blocks.push(kitchen);

  const bar = buildBarSection(input);
  if (bar) blocks.push(bar);

  const guestIntel = retrieveGuestIntelEvidence(input.guestMemory);
  if (guestIntel) blocks.push(guestIntel);

  const guestRelationship = input.guestMemory
    ? formatGuestRelationshipActiveMemoryBlock(input.guestMemory)
    : "";
  if (guestRelationship) blocks.push(guestRelationship);

  const guestHistory = input.guestMemory
    ? formatGuestHistoryBlock(input.guestMemory)
    : "";
  if (guestHistory) blocks.push(guestHistory);

  const loyaltyBlock = input.loyaltyContext
    ? buildLoyaltyContextBlock(input.loyaltyContext)
    : input.guestMemory
      ? buildLoyaltyContextBlock({
          visitCount: input.guestMemory.visitCount,
          totalSpent: (input.guestMemory.avgSpendCents ?? 0) / 100,
          pointsBalance: 0,
          lastVisitItemNames: input.guestMemory.lastVisitItemNames,
        })
      : "";
  if (loyaltyBlock) blocks.push(loyaltyBlock);

  const scrollIntel = buildScrollIntelligenceSection(input.state?.browse);
  if (scrollIntel) blocks.push(scrollIntel);

  const browseContext = buildBrowseContextSection(input.state?.browse);
  if (browseContext) blocks.push(browseContext);

  const externalContext = buildExternalContextSituationBlock(
    input.contextAwareness
  );
  if (externalContext) blocks.push(externalContext);

  const ops = retrieveVenueOpsEvidence(input.venueOps, input.opsEffects);
  if (ops) blocks.push(ops);

  const rhythm = retrieveVenueRhythmEvidence(input.rhythm);
  if (rhythm) blocks.push(rhythm);

  const venueKnowledge = formatVenueKnowledgeBlock(input.venueKnowledge);
  if (venueKnowledge) blocks.push(venueKnowledge);

  const activeMemory = input.state?.timeline
    ? buildActiveMemory(
        input.state.timeline,
        undefined,
        Date.now(),
        input.state.conversation?.model?.graph ?? null
      )
    : null;
  const activeMemoryBlock = activeMemory
    ? formatActiveMemoryBlock(activeMemory)
    : "";
  if (activeMemoryBlock) blocks.push(activeMemoryBlock);

  if (!conversationEvidence) {
    const transcript = retrieveTranscriptWindowEvidence(input.transcript ?? []);
    if (transcript) blocks.push(transcript);
  }

  if (input.vkgPairingBlock?.trim()) {
    blocks.push(input.vkgPairingBlock.trim());
  }

  if (input.playbookBlock?.trim()) {
    blocks.push(input.playbookBlock.trim());
  }

  blocks.push(buildPhaseBehaviorSection(input));

  return blocks.filter(Boolean).join("\n\n");
}
