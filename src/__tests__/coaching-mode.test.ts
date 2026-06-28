import { describe, expect, it } from "vitest";
import { emptyGuestOfferContext } from "@/lib/denis/cognition/offer/empty-guest-offer-context";
import { emptyGuestMentalModel } from "@/lib/denis/cognition/mental-model/empty-mental-model";
import { emptyBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import { emptyConversationModel } from "@/lib/denis/cognition/conversation/empty-conversation-model";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";
import { buildMergedCart } from "@/lib/denis/loop/merge-session-cart";
import type { TableSessionState } from "@/lib/denis/loop/types";

function baseState(overrides: Partial<TableSessionState> = {}): TableSessionState {
  return {
    table: { id: "t1", name: "Sto 4", token: "tok" },
    session: {
      id: "s1",
      status: "active",
      accessState: null,
      billSettled: false,
      feedbackSubmitted: false,
      denisEnabled: true,
      denisActive: true,
    },
    commerce: {
      orders: [],
      cart: buildMergedCart({ ai: emptyCartState() }),
    },
    venue: {
      ops: {
        operatingMode: "normal",
        kdsStress: "normal",
        acceptingOrders: true,
        unavailableProductIds: [],
        staffHint: null,
        stationStress: [],
      },
      opsEffects: {
        skipUpsell: false,
        shortenReplies: false,
        empathyNote: null,
        guestSafeStaffHint: null,
      },
    },
    conversation: {
      flowNodeId: "idle",
      foodUpsellAsked: false,
      dismissedNudges: [],
      lastAssistantMessage: null,
      pendingSlot: null,
      model: emptyConversationModel(),
      obligation: null,
    },
    timeline: [],
    browse: emptyBrowseProfile(),
    mental: emptyGuestMentalModel(),
    offer: emptyGuestOfferContext(),
    config: CONCIERGE_PLATFORM_DEFAULTS,
    ...overrides,
  };
}

import {
  generateCoachingHint,
  scoreCoachingFollow,
} from "@/lib/denis/staff/coaching-mode";

describe("coaching mode X3", () => {
  it("generates now-priority hint when guest waits 4+ min without staff nearby", () => {
    const openedAt = new Date(Date.now() - 4 * 60_000).toISOString();
    const mental = { ...emptyGuestMentalModel(), intent: "exploring" as const };

    const hint = generateCoachingHint({
      tableState: baseState({ mental }),
      mental,
      trajectory: {
        ordering: "stuck",
        engagement: "lull",
        meal: "pre",
        interruptionRisk: 0.2,
        opportunity: 0.5,
        evidence: [],
      },
      staffProximity: false,
      sessionOpenedAt: openedAt,
    });

    expect(hint).not.toBeNull();
    expect(hint!.priority).toBe("now");
    expect(hint!.suggestion).toContain("Sto 4");
  });

  it("scores active mode follow-through", () => {
    const updated = scoreCoachingFollow(
      {
        staffId: "staff-1",
        mode: "active",
        hintsGiven: 2,
        hintsFollowed: 1,
        score: 70,
      },
      true
    );
    expect(updated.score).toBe(80);
    expect(updated.hintsFollowed).toBe(2);
  });
});
