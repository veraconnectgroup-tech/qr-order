import type { BrowseEvent } from "@/lib/denis/cognition/browse/browse-types";
import { foldBrowseProfile } from "@/lib/denis/cognition/browse/fold-browse-profile";
import { foldConversationModel } from "@/lib/denis/cognition/conversation/fold-conversation-model";
import type {
  FoldGuestMentalModelInput,
  GuestEngagement,
  GuestFrustrationLevel,
  GuestIntent,
  GuestMealStage,
  GuestMentalModel,
  GuestNudgeBudget,
  GuestPace,
  GuestPredictedNeed,
  GuestPriceAffinity,
  GuestReceptiveness,
} from "@/lib/denis/cognition/mental-model/mental-model-types";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";
import { buildMergedCart } from "@/lib/denis/loop/merge-session-cart";
import type { OrderFact, SessionPhase } from "@/lib/denis/loop/types";
import type { FlowNodeId } from "@/lib/denis/platform/flow-types";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

/** Eval-only party fixture — mirrors venue TablePartyModel without venue layer import. */
export type MentalModelPartyFixture = {
  tableSessionId: string;
  partyMode: "shared_cart" | "per_device";
  sharedAiSessionId: string | null;
  devices: Array<{
    deviceFingerprint: string;
    aiSessionId: string | null;
    displayName: string | null;
    isPrimary: boolean;
    manualCartRevision: number;
    manualCartSnapshot: unknown;
    lastActiveAt: string;
  }>;
  activeDeviceCount: number;
  currentDeviceFingerprint: string | null;
  isCurrentDevicePrimary: boolean;
};

export type MentalModelScenario = {
  id: string;
  description: string;
  timeline: DenisTimelineRow[];
  phase: SessionPhase;
  flowNodeId?: FlowNodeId;
  dismissedNudges?: string[];
  party?: MentalModelPartyFixture | null;
  orders?: OrderFact[];
  billSettled?: boolean;
  expect: {
    intent?: GuestIntent;
    pace?: GuestPace;
    receptiveness?: GuestReceptiveness;
    mealStage?: GuestMealStage;
    nudgeBudgetRemaining?: number;
    nudgeBudgetMax?: number;
    engagementGuestInitiated?: boolean;
    minGuestTurns?: number;
    frustrationLevel?: GuestFrustrationLevel;
    predictedNeed?: GuestPredictedNeed;
    priceAffinity?: GuestPriceAffinity;
    addressLeader?: boolean;
    groupMode?: "solo" | "party";
  };
};

const AI = "00000000-0000-4000-8000-000000000099";
const NOW = Date.parse("2026-06-07T12:30:00.000Z");
const PRODUCT = "11111111-1111-4111-8111-111111111111";

export function browseRow(seq: number, event: BrowseEvent): DenisTimelineRow {
  return {
    id: `browse-${seq}`,
    ai_session_id: AI,
    seq,
    event_type: "perception.ingested",
    payload: {
      type: "perception.ingested",
      frame: {
        channel: "telemetry.browse",
        normalizedText: String(event.productName ?? event.categoryPath ?? ""),
        structuredIntent: "BROWSE",
        ingestedAt: String(event.timestamp),
      },
      envelope: { traceId: `trace-${seq}`, surface: "sense" },
      browseEvent: event,
    },
    trace_id: `trace-${seq}`,
    context_hash: null,
    created_at: event.timestamp,
  };
}

export function guestMessageRow(seq: number, text: string, at: string): DenisTimelineRow {
  return {
    id: `msg-${seq}`,
    ai_session_id: AI,
    seq,
    event_type: "signal.message",
    payload: {
      type: "signal.message",
      text,
      channel: "chat.message",
    },
    trace_id: `trace-${seq}`,
    context_hash: null,
    created_at: at,
  };
}

export function buildMentalModelFoldInput(
  scenario: Pick<
    MentalModelScenario,
    | "timeline"
    | "phase"
    | "flowNodeId"
    | "dismissedNudges"
    | "party"
    | "orders"
    | "billSettled"
  >
): FoldGuestMentalModelInput {
  const flowNodeId = scenario.flowNodeId ?? "welcome";
  const browse = foldBrowseProfile(scenario.timeline);
  const conversation = foldConversationModel({
    timeline: scenario.timeline,
    flowNodeId,
    pendingSlot: null,
    commerceConfirm: false,
  });

  return {
    timeline: scenario.timeline,
    browse,
    conversation,
    commerce: {
      orders: scenario.orders ?? [],
      cart: buildMergedCart({ ai: emptyCartState() }),
    },
    party: scenario.party ?? null,
    session: { billSettled: scenario.billSettled ?? false },
    conversationMeta: {
      flowNodeId,
      dismissedNudges: scenario.dismissedNudges ?? [],
    },
    phase: scenario.phase,
    config: CONCIERGE_PLATFORM_DEFAULTS,
    now: NOW,
  };
}

export const MENTAL_MODEL_SCENARIOS: MentalModelScenario[] = [
  {
    id: "gmm_arrived_welcome_ok",
    description: "0 messages, phase latent → intent arrived",
    timeline: [],
    phase: "latent",
    expect: {
      intent: "arrived",
      receptiveness: "neutral",
      engagementGuestInitiated: false,
    },
  },
  {
    id: "gmm_exploring_browse_ok",
    description: "browse food 3 products, 0 cart → intent exploring",
    timeline: [
      browseRow(1, {
        action: "view_product",
        productId: "p1",
        productName: "Burger",
        categoryPath: ["food", "burgers"],
        menuSection: "food",
        dwellMs: 4000,
        timestamp: "2026-06-07T12:00:01.000Z",
      }),
      browseRow(2, {
        action: "view_product",
        productId: "p2",
        productName: "Pasta",
        categoryPath: ["food", "pasta"],
        menuSection: "food",
        dwellMs: 3500,
        timestamp: "2026-06-07T12:00:02.000Z",
      }),
      browseRow(3, {
        action: "view_product",
        productId: "p3",
        productName: "Salad",
        categoryPath: ["food", "salads"],
        menuSection: "food",
        dwellMs: 2800,
        timestamp: "2026-06-07T12:00:03.000Z",
      }),
    ],
    phase: "browsing",
    expect: {
      intent: "exploring",
      receptiveness: "open",
    },
  },
  {
    id: "gmm_closed_blocks_nudge",
    description: "2× dismissed nudge + ne hvala → closed, budget 0",
    timeline: [
      guestMessageRow(1, "ne hvala", "2026-06-07T12:00:04.000Z"),
    ],
    phase: "browsing",
    dismissedNudges: ["browse_nudge", "popularity_pair"],
    expect: {
      receptiveness: "closed",
      nudgeBudgetRemaining: 0,
      nudgeBudgetMax: 0,
    },
  },
  {
    id: "gmm_indecisive_pace",
    description: "4× add/remove same product → pace indecisive",
    timeline: [
      browseRow(1, {
        action: "add_to_cart",
        productId: PRODUCT,
        productName: "Pilsner",
        categoryPath: ["drinks", "beer"],
        menuSection: "drinks",
        timestamp: "2026-06-07T12:00:01.000Z",
      }),
      browseRow(2, {
        action: "remove_from_cart",
        productId: PRODUCT,
        productName: "Pilsner",
        categoryPath: ["drinks", "beer"],
        menuSection: "drinks",
        timestamp: "2026-06-07T12:00:02.000Z",
      }),
      browseRow(3, {
        action: "add_to_cart",
        productId: PRODUCT,
        productName: "Pilsner",
        categoryPath: ["drinks", "beer"],
        menuSection: "drinks",
        timestamp: "2026-06-07T12:00:03.000Z",
      }),
      browseRow(4, {
        action: "remove_from_cart",
        productId: PRODUCT,
        productName: "Pilsner",
        categoryPath: ["drinks", "beer"],
        menuSection: "drinks",
        timestamp: "2026-06-07T12:00:04.000Z",
      }),
    ],
    phase: "browsing",
    expect: {
      pace: "indecisive",
      intent: "comparing",
    },
  },
  {
    id: "gmm_engagement_initiated",
    description: "guest sends 3 messages before proactive → guestInitiated",
    timeline: [
      guestMessageRow(1, "zdravo", "2026-06-07T12:00:01.000Z"),
      guestMessageRow(2, "sta da jedem", "2026-06-07T12:00:02.000Z"),
      guestMessageRow(3, "hvala", "2026-06-07T12:00:03.000Z"),
    ],
    phase: "ordering",
    expect: {
      engagementGuestInitiated: true,
      minGuestTurns: 3,
      receptiveness: "enthusiastic",
    },
  },
  {
    id: "gmm_price_affinity_budget",
    description: "Short browse dwell → budget price affinity",
    timeline: [
      browseRow(1, {
        action: "view_product",
        productId: "p1",
        productName: "Burger",
        categoryPath: ["food"],
        menuSection: "food",
        dwellMs: 2000,
        timestamp: "2026-06-07T12:00:01.000Z",
      }),
      browseRow(2, {
        action: "view_product",
        productId: "p2",
        productName: "Pasta",
        categoryPath: ["food"],
        menuSection: "food",
        dwellMs: 1800,
        timestamp: "2026-06-07T12:00:02.000Z",
      }),
    ],
    phase: "browsing",
    expect: { priceAffinity: "budget" },
  },
  {
    id: "gmm_price_affinity_premium",
    description: "Long browse dwell → premium price affinity",
    timeline: [
      browseRow(1, {
        action: "view_product",
        productId: "p1",
        productName: "Wagyu",
        categoryPath: ["food", "premium"],
        menuSection: "food",
        dwellMs: 9000,
        timestamp: "2026-06-07T12:00:01.000Z",
      }),
      browseRow(2, {
        action: "view_product",
        productId: "p2",
        productName: "Truffle pasta",
        categoryPath: ["food", "premium"],
        menuSection: "food",
        dwellMs: 8500,
        timestamp: "2026-06-07T12:00:02.000Z",
      }),
    ],
    phase: "browsing",
    expect: { priceAffinity: "premium" },
  },
  {
    id: "gmm_dessert_window",
    description: "Food delivered + browsed desserts → dessert_window, dessert gate allow",
    timeline: [
      browseRow(1, {
        action: "view_product",
        productId: "d1",
        productName: "Tiramisu",
        categoryPath: ["desserts"],
        menuSection: "desserts",
        dwellMs: 5000,
        timestamp: "2026-06-07T12:00:01.000Z",
      }),
    ],
    phase: "waiting",
    orders: [
      {
        id: "ord-main",
        orderNumber: 12,
        status: "delivered",
        paymentStatus: "paid",
        estimatedPrepMinutes: null,
        createdAt: "2026-06-07T11:30:00.000Z",
        items: [{ productName: "Burger", quantity: 1 }],
      },
    ],
    expect: {
      mealStage: "dessert_window",
      predictedNeed: "wants_dessert",
    },
  },
  {
    id: "gmm_wants_drink_aperitif",
    description: "Delivered drink + browsing drinks → wants_drink",
    timeline: [
      browseRow(1, {
        action: "view_product",
        productId: "beer-1",
        productName: "Pilsner",
        categoryPath: ["drinks", "beer"],
        menuSection: "drinks",
        dwellMs: 3000,
        timestamp: "2026-06-07T12:00:01.000Z",
      }),
    ],
    phase: "browsing",
    orders: [
      {
        id: "ord-drink",
        orderNumber: 3,
        status: "delivered",
        paymentStatus: "paid",
        estimatedPrepMinutes: null,
        createdAt: "2026-06-07T12:00:00.000Z",
        items: [{ productName: "Pilsner 0.5L", quantity: 1 }],
      },
    ],
    expect: {
      mealStage: "between_courses",
      predictedNeed: "wants_drink",
      intent: "exploring",
    },
  },
  {
    id: "gmm_decline_cooldown_no_third",
    description: "2× decline + cooldown → gate denies third upsell (iota pilot)",
    timeline: [
      guestMessageRow(1, "ne hvala", "2026-06-07T12:00:01.000Z"),
      guestMessageRow(2, "ne treba", "2026-06-07T12:00:02.000Z"),
    ],
    phase: "browsing",
    dismissedNudges: ["browse_nudge", "popularity_pair"],
    expect: {
      receptiveness: "closed",
      nudgeBudgetRemaining: 0,
    },
  },
  {
    id: "gmm_frustrated_escalate",
    description: "ČEKAM??? + repeated message → frustration high, needs_attention",
    timeline: [
      guestMessageRow(1, "ČEKAM???", "2026-06-07T12:00:01.000Z"),
      guestMessageRow(2, "gde je hrana", "2026-06-07T12:00:02.000Z"),
      guestMessageRow(3, "gde je hrana", "2026-06-07T12:00:03.000Z"),
    ],
    phase: "waiting",
    expect: {
      frustrationLevel: "high",
      predictedNeed: "needs_attention",
    },
  },
  {
    id: "gmm_party_leader_only",
    description: "2 devices, follower current → addressLeader false",
    timeline: [guestMessageRow(1, "zdravo", "2026-06-07T12:00:01.000Z")],
    phase: "ordering",
    party: {
      tableSessionId: "table-1",
      partyMode: "shared_cart",
      sharedAiSessionId: AI,
      devices: [
        {
          deviceFingerprint: "device-primary",
          aiSessionId: AI,
          displayName: "Host",
          isPrimary: true,
          manualCartRevision: 0,
          manualCartSnapshot: null,
          lastActiveAt: "2026-06-07T12:00:00.000Z",
        },
        {
          deviceFingerprint: "device-follower",
          aiSessionId: "00000000-0000-4000-8000-000000000088",
          displayName: "Guest 2",
          isPrimary: false,
          manualCartRevision: 0,
          manualCartSnapshot: null,
          lastActiveAt: "2026-06-07T12:00:01.000Z",
        },
      ],
      activeDeviceCount: 2,
      currentDeviceFingerprint: "device-follower",
      isCurrentDevicePrimary: false,
    },
    expect: {
      groupMode: "party",
      addressLeader: false,
    },
  },
];

export type MentalModelExpectFields = MentalModelScenario["expect"];

export function assertMentalModelExpect(
  model: GuestMentalModel,
  expect: MentalModelExpectFields,
  errors: string[],
  prefix = ""
): void {
  const label = prefix ? `${prefix}: ` : "";

  if (expect.intent !== undefined && model.intent !== expect.intent) {
    errors.push(`${label}intent expected ${expect.intent}, got ${model.intent}`);
  }
  if (expect.pace !== undefined && model.pace !== expect.pace) {
    errors.push(`${label}pace expected ${expect.pace}, got ${model.pace}`);
  }
  if (expect.mealStage !== undefined && model.mealStage !== expect.mealStage) {
    errors.push(
      `${label}mealStage expected ${expect.mealStage}, got ${model.mealStage}`
    );
  }
  if (
    expect.receptiveness !== undefined &&
    model.receptiveness !== expect.receptiveness
  ) {
    errors.push(
      `${label}receptiveness expected ${expect.receptiveness}, got ${model.receptiveness}`
    );
  }
  if (
    expect.nudgeBudgetRemaining !== undefined &&
    model.nudgeBudget.remaining !== expect.nudgeBudgetRemaining
  ) {
    errors.push(
      `${label}nudgeBudget.remaining expected ${expect.nudgeBudgetRemaining}, got ${model.nudgeBudget.remaining}`
    );
  }
  if (
    expect.nudgeBudgetMax !== undefined &&
    model.nudgeBudget.max !== expect.nudgeBudgetMax
  ) {
    errors.push(
      `${label}nudgeBudget.max expected ${expect.nudgeBudgetMax}, got ${model.nudgeBudget.max}`
    );
  }
  if (
    expect.engagementGuestInitiated !== undefined &&
    model.engagement.guestInitiated !== expect.engagementGuestInitiated
  ) {
    errors.push(
      `${label}engagement.guestInitiated expected ${expect.engagementGuestInitiated}, got ${model.engagement.guestInitiated}`
    );
  }
  if (
    expect.minGuestTurns !== undefined &&
    model.engagement.guestTurns < expect.minGuestTurns
  ) {
    errors.push(
      `${label}engagement.guestTurns expected >= ${expect.minGuestTurns}, got ${model.engagement.guestTurns}`
    );
  }
  if (
    expect.frustrationLevel !== undefined &&
    model.affect.frustration.level !== expect.frustrationLevel
  ) {
    errors.push(
      `${label}affect.frustration.level expected ${expect.frustrationLevel}, got ${model.affect.frustration.level}`
    );
  }
  if (
    expect.predictedNeed !== undefined &&
    model.predictedNeed !== expect.predictedNeed
  ) {
    errors.push(
      `${label}predictedNeed expected ${expect.predictedNeed}, got ${model.predictedNeed}`
    );
  }
  if (
    expect.priceAffinity !== undefined &&
    model.priceAffinity !== expect.priceAffinity
  ) {
    errors.push(
      `${label}priceAffinity expected ${expect.priceAffinity}, got ${model.priceAffinity}`
    );
  }
  if (
    expect.addressLeader !== undefined &&
    model.groupDynamics.addressLeader !== expect.addressLeader
  ) {
    errors.push(
      `${label}groupDynamics.addressLeader expected ${expect.addressLeader}, got ${model.groupDynamics.addressLeader}`
    );
  }
  if (expect.groupMode !== undefined && model.groupDynamics.mode !== expect.groupMode) {
    errors.push(
      `${label}groupDynamics.mode expected ${expect.groupMode}, got ${model.groupDynamics.mode}`
    );
  }
}

export type { GuestEngagement, GuestNudgeBudget };
