import { emptyBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import { emptyConversationModel } from "@/lib/denis/cognition/conversation/empty-conversation-model";
import { emptyGuestMentalModel } from "@/lib/denis/cognition/mental-model/empty-mental-model";
import { emptyGuestOfferContext } from "@/lib/denis/cognition/offer/empty-guest-offer-context";
import type { InterventionManifestSimScenario } from "@/lib/denis/cognition/intervention/run-intervention-manifest-sim";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";
import { buildMergedCart } from "@/lib/denis/loop/merge-session-cart";
import type { TableSessionState } from "@/lib/denis/loop/types";

const NOW = Date.parse("2026-06-07T20:00:00.000Z");

function minimalState(
  patch?: Partial<Pick<TableSessionState, "mental" | "offer" | "timeline" | "browse">>
): TableSessionState {
  return {
    table: { id: "t1", name: "T1", token: "tok" },
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
      },
      opsEffects: {
        skipUpsell: false,
        shortenReplies: false,
        empathyNote: null,
        guestSafeStaffHint: null,
      },
    },
    conversation: {
      flowNodeId: "guest.seated",
      foodUpsellAsked: false,
      dismissedNudges: [],
      lastAssistantMessage: null,
      pendingSlot: null,
      model: emptyConversationModel(),
      obligation: null,
    },
    timeline: [],
    browse: emptyBrowseProfile(),
    mental: emptyGuestMentalModel(NOW),
    offer: emptyGuestOfferContext(NOW),
    config: CONCIERGE_PLATFORM_DEFAULTS,
    ...patch,
  };
}

/** Shared IJS manifest sim corpus for promote gate + eval (ADR-041 P4). */
export const INTERVENTION_MANIFEST_SIM_SCENARIOS: InterventionManifestSimScenario[] =
  [
    {
      id: "ijs_sim_enforce_block",
      state: minimalState({
        mental: {
          ...emptyGuestMentalModel(NOW),
          intent: "arrived",
          predictedNeed: "none",
        },
      }),
      proactiveResult: {
        beliefs: {} as never,
        turnPlan: { kind: "template_tell", requiresLlm: false } as never,
        nudge: { kind: "browse_nudge", message: "Help?" },
        message: "Help?",
        skipped: false,
        skipReason: null,
        candidateKind: "browse_nudge",
      },
      enforceBlock: true,
      expectDecision: "silence",
    },
    {
      id: "ijs_sim_upds_skip",
      state: minimalState(),
      proactiveResult: {
        beliefs: {} as never,
        turnPlan: null,
        nudge: null,
        message: null,
        skipped: true,
        skipReason: "cooldown",
        candidateKind: null,
      },
      expectDecision: "silence",
    },
  ];
