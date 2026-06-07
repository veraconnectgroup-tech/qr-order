import { describe, expect, it } from "vitest";
import { decideProactiveTurnPlan } from "@/lib/denis/cognition/proactive/decide-proactive-turn-plan";
import { planProactiveTurn } from "@/lib/denis/cognition/proactive/plan-proactive-turn";
import { compileBeliefs } from "@/lib/denis/cognition/beliefs/compile-beliefs";
import { emptyConversationModel } from "@/lib/denis/cognition/conversation/empty-conversation-model";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";
import { buildMergedCart } from "@/lib/denis/loop/merge-session-cart";
import type { TableSessionState } from "@/lib/denis/loop/types";
import {
  ANTICIPATION_MIN_SCENARIOS,
  ANTICIPATION_SCENARIOS,
} from "@/lib/denis/eval/fixtures/anticipation/scenarios";
import { runAnticipationEval } from "@/lib/denis/eval/run-anticipation-eval";
import type { GuestProactiveNudge } from "@/lib/denis/runtime/evaluate-proactive-tick";

function minimalState(
  patch?: Partial<TableSessionState["conversation"]>
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
      ...patch,
    },
    timeline: [],
    config: CONCIERGE_PLATFORM_DEFAULTS,
  };
}

describe("decideProactiveTurnPlan", () => {
  it("blocks dessert during waiting phase", () => {
    const beliefs = compileBeliefs({
      state: minimalState(),
      guestMessage: "",
    });
    const candidate: GuestProactiveNudge = {
      kind: "dessert_nudge",
      message: "Desert?",
    };

    const result = decideProactiveTurnPlan({
      beliefs,
      candidate,
      sessionPhase: "waiting",
      config: CONCIERGE_PLATFORM_DEFAULTS,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("phase.dessert_blocked");
    }
  });

  it("allows dessert in settling", () => {
    const beliefs = compileBeliefs({
      state: minimalState(),
      guestMessage: "",
    });
    const candidate: GuestProactiveNudge = {
      kind: "dessert_nudge",
      message: "Desert?",
    };

    const result = decideProactiveTurnPlan({
      beliefs,
      candidate,
      sessionPhase: "settling",
      config: CONCIERGE_PLATFORM_DEFAULTS,
    });

    expect(result.ok).toBe(true);
  });
});

describe("planProactiveTurn", () => {
  it("routes browse nudge through template_tell", () => {
    const result = planProactiveTurn({
      state: minimalState(),
      config: CONCIERGE_PLATFORM_DEFAULTS,
      orders: [],
      sessionPhase: "browsing",
      payload: { browseMinutes: 5 },
    });

    expect(result.skipped).toBe(false);
    expect(result.turnPlan?.kind).toBe("template_tell");
    expect(result.turnPlan?.requiresLlm).toBe(false);
    expect(result.nudge?.kind).toBe("browse_nudge");
  });
});

describe("runAnticipationEval", () => {
  it("has minimum scenario count", () => {
    expect(ANTICIPATION_SCENARIOS.length).toBeGreaterThanOrEqual(
      ANTICIPATION_MIN_SCENARIOS
    );
  });

  it("passes anticipation suite", () => {
    const report = runAnticipationEval();
    if (!report.ok) {
      const failed = report.results.filter((row) => !row.passed);
      console.error(JSON.stringify(failed, null, 2));
    }
    expect(report.ok).toBe(true);
  });
});
