import { foldBrowseProfile } from "@/lib/denis/cognition/browse/fold-browse-profile";
import { emptyGuestMentalModel } from "@/lib/denis/cognition/mental-model/empty-mental-model";
import { foldGuestMentalModel } from "@/lib/denis/cognition/mental-model/fold-guest-mental-model";
import { foldGuestSignals } from "@/lib/denis/cognition/mental-model/fold-guest-signals";
import type { GuestMentalModel } from "@/lib/denis/cognition/mental-model/mental-model-types";
import { foldGuestOfferContext } from "@/lib/denis/cognition/offer/fold-guest-offer-context";
import type {
  BrowseSequencePattern,
  FoldGuestOfferContextInput,
  GuestOfferContext,
  OfferReadinessReason,
  OfferResolutionKind,
} from "@/lib/denis/cognition/offer/offer-types";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import type { SessionPhase } from "@/lib/denis/loop/types";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";
import {
  browseRow,
  buildMentalModelFoldInput,
} from "@/lib/denis/eval/fixtures/mental-model/scenarios";

/** Eval-only venue ops fixture — mirrors VenueOpsBeliefs without venue layer import. */
export type OfferVenueOpsFixture = {
  operatingMode?: "normal" | "kitchen_closed";
  kdsStress?: "normal" | "high";
};

export type OfferFoldScenario = {
  id: string;
  description: string;
  timeline: DenisTimelineRow[];
  phase?: SessionPhase;
  dismissedNudges?: string[];
  cartLineCount?: number;
  venueOps?: OfferVenueOpsFixture;
  mentalOverride?: Partial<GuestMentalModel>;
  expect: {
    strategy?: string;
    sequencePattern?: BrowseSequencePattern;
    readinessReason?: OfferReadinessReason;
    readinessReady?: boolean;
    primaryResolution?: OfferResolutionKind | null;
    primaryProductName?: string | null;
    primaryNull?: boolean;
    cartRecoveryProductName?: string | null;
    kitchenBlocked?: boolean;
    hasAlternative?: boolean;
  };
};

export const OFFER_EVAL_NOW = Date.parse("2026-06-07T12:30:00.000Z");

const BURGER = "11111111-1111-4111-8111-111111111111";
const PASTA = "33333333-3333-4333-8333-333333333333";
const PILSNER = "22222222-2222-4222-8222-222222222222";

export function buildOfferFoldInput(
  scenario: OfferFoldScenario
): FoldGuestOfferContextInput {
  const timeline = scenario.timeline;
  const phase = scenario.phase ?? "browsing";
  const dismissedNudges = scenario.dismissedNudges ?? [];
  const browse = foldBrowseProfile(timeline);
  const config = {
    ...CONCIERGE_PLATFORM_DEFAULTS,
    mentalModel: {
      ...CONCIERGE_PLATFORM_DEFAULTS.mentalModel,
      mode: "enforce" as const,
    },
  };

  const mental =
    scenario.mentalOverride != null
      ? { ...emptyGuestMentalModel(OFFER_EVAL_NOW), ...scenario.mentalOverride }
      : foldGuestMentalModel(
          buildMentalModelFoldInput({
            timeline,
            phase,
            flowNodeId: "browse",
            dismissedNudges,
          })
        );

  return {
    timeline,
    browse,
    mental,
    spine: foldGuestSignals({ timeline, dismissedNudgeKeys: dismissedNudges }),
    venueOps: {
      operatingMode: scenario.venueOps?.operatingMode ?? "normal",
      kdsStress: scenario.venueOps?.kdsStress ?? "normal",
      acceptingOrders: true,
      unavailableProductIds: [],
      staffHint: null,
    } satisfies FoldGuestOfferContextInput["venueOps"],
    phase,
    cartLineCount: scenario.cartLineCount ?? 0,
    config,
    now: OFFER_EVAL_NOW,
  };
}

export function foldOfferForScenario(scenario: OfferFoldScenario): GuestOfferContext {
  return foldGuestOfferContext(buildOfferFoldInput(scenario));
}

export function assertOfferExpect(
  offer: GuestOfferContext,
  expect: OfferFoldScenario["expect"],
  errors: string[]
): void {
  if (expect.strategy != null && offer.trace.strategy !== expect.strategy) {
    errors.push(
      `strategy: expected ${expect.strategy}, got ${offer.trace.strategy}`
    );
  }
  if (
    expect.sequencePattern != null &&
    offer.sequencePattern !== expect.sequencePattern
  ) {
    errors.push(
      `sequencePattern: expected ${expect.sequencePattern}, got ${offer.sequencePattern}`
    );
  }
  if (
    expect.readinessReason != null &&
    offer.readiness.reason !== expect.readinessReason
  ) {
    errors.push(
      `readiness.reason: expected ${expect.readinessReason}, got ${offer.readiness.reason}`
    );
  }
  if (
    expect.readinessReady != null &&
    offer.readiness.ready !== expect.readinessReady
  ) {
    errors.push(
      `readiness.ready: expected ${expect.readinessReady}, got ${offer.readiness.ready}`
    );
  }
  if (expect.primaryNull === true && offer.primary != null) {
    errors.push(`primary: expected null, got ${offer.primary.productName}`);
  }
  if (
    expect.primaryProductName != null &&
    offer.primary?.productName !== expect.primaryProductName
  ) {
    errors.push(
      `primary.productName: expected ${expect.primaryProductName}, got ${offer.primary?.productName ?? "null"}`
    );
  }
  if (
    expect.primaryResolution != null &&
    offer.primary?.resolution !== expect.primaryResolution
  ) {
    errors.push(
      `primary.resolution: expected ${expect.primaryResolution}, got ${offer.primary?.resolution ?? "null"}`
    );
  }
  if (
    expect.cartRecoveryProductName != null &&
    offer.cartRecovery?.productName !== expect.cartRecoveryProductName
  ) {
    errors.push(
      `cartRecovery.productName: expected ${expect.cartRecoveryProductName}, got ${offer.cartRecovery?.productName ?? "null"}`
    );
  }
  if (
    expect.kitchenBlocked != null &&
    offer.primary?.isKitchenBlocked !== expect.kitchenBlocked
  ) {
    errors.push(
      `primary.isKitchenBlocked: expected ${expect.kitchenBlocked}, got ${offer.primary?.isKitchenBlocked ?? "null"}`
    );
  }
  if (expect.hasAlternative === true && offer.alternative == null) {
    errors.push("alternative: expected non-null kitchen alternative");
  }
  if (expect.hasAlternative === false && offer.alternative != null) {
    errors.push(`alternative: expected null, got ${offer.alternative.productName}`);
  }
}

export const OFFER_FOLD_SCENARIOS: OfferFoldScenario[] = [
  {
    id: "offer_empty_no_browse",
    description: "empty timeline yields no scored product",
    timeline: [],
    expect: {
      strategy: "no_scored_product",
      sequencePattern: "unknown",
      primaryNull: true,
      readinessReason: "not_ready_posture",
    },
  },
  {
    id: "offer_help_choosing_top_dwell",
    description: "needs_help_choosing posture resolves top dwell product",
    timeline: [
      browseRow(1, {
        action: "view_product",
        productId: BURGER,
        productName: "Beef Burger",
        categoryId: "cat-burgers",
        categoryPath: ["food", "burgers"],
        menuSection: "food",
        dwellMs: 35_000,
        timestamp: "2026-06-07T12:29:50.000Z",
      }),
    ],
    mentalOverride: {
      predictedNeed: "needs_help_choosing",
      intent: "exploring",
      pace: "normal",
      receptiveness: "open",
    },
    expect: {
      strategy: "exploring_top_dwell",
      sequencePattern: "decisive",
      primaryProductName: "Beef Burger",
      primaryResolution: "top_dwell",
      readinessReason: "browse_pause",
      readinessReady: true,
    },
  },
  {
    id: "offer_return_view",
    description: "repeat product view resolves return_view offer",
    timeline: [
      browseRow(1, {
        action: "view_product",
        productId: BURGER,
        productName: "Beef Burger",
        categoryId: "cat-burgers",
        categoryPath: ["food", "burgers"],
        menuSection: "food",
        dwellMs: 4200,
        timestamp: "2026-06-07T12:29:40.000Z",
      }),
      browseRow(2, {
        action: "view_product",
        productId: BURGER,
        productName: "Beef Burger",
        categoryId: "cat-burgers",
        categoryPath: ["food", "burgers"],
        menuSection: "food",
        dwellMs: 5100,
        timestamp: "2026-06-07T12:29:55.000Z",
      }),
    ],
    mentalOverride: {
      predictedNeed: "needs_help_choosing",
      intent: "comparing",
      pace: "normal",
      receptiveness: "open",
    },
    expect: {
      strategy: "comparing_top_dwell",
      sequencePattern: "return_view",
      primaryProductName: "Beef Burger",
      primaryResolution: "return_view",
      readinessReason: "return_view",
      readinessReady: true,
    },
  },
  {
    id: "offer_cart_recovery",
    description: "cart abandon + indecisive pace triggers recovery offer",
    timeline: [
      browseRow(1, {
        action: "add_to_cart",
        productId: PILSNER,
        productName: "Pilsner",
        categoryPath: ["drinks", "beer"],
        menuSection: "drinks",
        timestamp: "2026-06-07T12:29:00.000Z",
      }),
      browseRow(2, {
        action: "remove_from_cart",
        productId: PILSNER,
        productName: "Pilsner",
        categoryPath: ["drinks", "beer"],
        menuSection: "drinks",
        timestamp: "2026-06-07T12:29:15.000Z",
      }),
    ],
    mentalOverride: {
      predictedNeed: "needs_help_choosing",
      pace: "indecisive",
      receptiveness: "open",
    },
    expect: {
      strategy: "cart_recovery_first",
      cartRecoveryProductName: "Pilsner",
      primaryProductName: "Pilsner",
      primaryResolution: "cart_recovery",
      readinessReason: "cart_hesitation",
      readinessReady: true,
    },
  },
  {
    id: "offer_kitchen_stress_alternative",
    description: "high KDS stress marks primary blocked and picks alternative",
    timeline: [
      browseRow(1, {
        action: "view_product",
        productId: BURGER,
        productName: "Beef Burger",
        categoryId: "cat-burgers",
        categoryPath: ["food", "burgers"],
        menuSection: "food",
        dwellMs: 18_000,
        timestamp: "2026-06-07T12:29:40.000Z",
      }),
      browseRow(2, {
        action: "view_product",
        productId: PASTA,
        productName: "Truffle Pasta",
        categoryId: "cat-pasta",
        categoryPath: ["food", "pasta"],
        menuSection: "food",
        dwellMs: 10_000,
        timestamp: "2026-06-07T12:29:55.000Z",
      }),
    ],
    venueOps: { kdsStress: "high" },
    mentalOverride: {
      predictedNeed: "needs_help_choosing",
      intent: "exploring",
      pace: "normal",
      receptiveness: "open",
    },
    expect: {
      strategy: "kitchen_alternative",
      primaryProductName: "Beef Burger",
      kitchenBlocked: true,
      hasAlternative: true,
    },
  },
  {
    id: "offer_venue_blocked",
    description: "kitchen_closed venue suppresses all offers",
    timeline: [
      browseRow(1, {
        action: "view_product",
        productId: BURGER,
        productName: "Beef Burger",
        categoryPath: ["food", "burgers"],
        menuSection: "food",
        dwellMs: 12_000,
        timestamp: "2026-06-07T12:29:50.000Z",
      }),
    ],
    venueOps: { operatingMode: "kitchen_closed" },
    mentalOverride: {
      predictedNeed: "needs_help_choosing",
      receptiveness: "open",
    },
    expect: {
      strategy: "venue_blocked",
      primaryNull: true,
    },
  },
  {
    id: "offer_posture_no_offer",
    description: "ready_to_order posture suppresses proactive offer resolution",
    timeline: [
      browseRow(1, {
        action: "view_product",
        productId: BURGER,
        productName: "Beef Burger",
        categoryPath: ["food", "burgers"],
        menuSection: "food",
        dwellMs: 14_000,
        timestamp: "2026-06-07T12:29:50.000Z",
      }),
    ],
    mentalOverride: {
      predictedNeed: "ready_to_order",
      intent: "ordering",
      pace: "normal",
      receptiveness: "open",
    },
    expect: {
      strategy: "posture_no_offer",
      primaryNull: true,
      readinessReason: "not_ready_posture",
    },
  },
];
