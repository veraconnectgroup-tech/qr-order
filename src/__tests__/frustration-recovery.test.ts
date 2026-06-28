import { describe, expect, it } from "vitest";
import { deriveAffect } from "@/lib/denis/cognition/mental-model/derive-affect";
import { foldGuestSignals } from "@/lib/denis/cognition/mental-model/fold-guest-signals";
import { gateProactiveNudge } from "@/lib/denis/cognition/proactive/apply-proactive-policy";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import {
  buildFrustrationRecoveryEvidence,
  deriveOrderLifecycleBeliefs,
  planFrustrationRecovery,
  resolveFrustrationStaffEscalation,
} from "@/lib/denis/cognition/recovery/frustration-recovery";
import { foldGuestMentalModel } from "@/lib/denis/cognition/mental-model/fold-guest-mental-model";
import {
  buildMentalModelFoldInput,
  guestMessageRow,
} from "@/lib/denis/eval/fixtures/mental-model/scenarios";

describe("planFrustrationRecovery", () => {
  it("returns empathy + urgent staff escalation when high frustration while waiting", () => {
    const spine = foldGuestSignals({
      timeline: [
        guestMessageRow(1, "koliko još?!!", "2026-06-07T12:00:01.000Z"),
        guestMessageRow(2, "koliko još?!!", "2026-06-07T12:00:02.000Z"),
      ],
      dismissedNudgeKeys: [],
    });
    const affect = deriveAffect(spine);

    expect(affect.frustration.level).toBe("high");

    const actions = planFrustrationRecovery({
      affect,
      orderLifecycle: deriveOrderLifecycleBeliefs({
        sessionPhase: "waiting",
        hasOpenKitchenOrders: true,
      }),
      staffOnFloor: true,
      language: "sr",
    });

    expect(actions.some((action) => action.kind === "empathy_reply")).toBe(true);
    const escalation = resolveFrustrationStaffEscalation(actions);
    expect(escalation?.urgency).toBe("urgent");
    expect(buildFrustrationRecoveryEvidence(actions)).toContain("provjeravam");
    expect(buildFrustrationRecoveryEvidence(actions)).not.toContain("uskoro stiže");
  });

  it("returns ordering empathy when mild frustration without orders", () => {
    const spine = foldGuestSignals({
      timeline: [guestMessageRow(1, "dugo čekam", "2026-06-07T12:00:01.000Z")],
      dismissedNudgeKeys: [],
    });
    const affect = deriveAffect(spine);

    const actions = planFrustrationRecovery({
      affect,
      orderLifecycle: deriveOrderLifecycleBeliefs({
        sessionPhase: "browsing",
        hasOpenKitchenOrders: false,
        hasAnyOrders: false,
      }),
      staffOnFloor: true,
      language: "sr",
    });

    expect(actions).toEqual([
      {
        kind: "empathy_reply",
        message: "Izvinite zbog čekanja — mogu pomoći s narudžbom?",
      },
    ]);
  });

  it("blocks upsell nudges but allows waiter_gap when frustration is mild", () => {
    const input = buildMentalModelFoldInput({
      timeline: [guestMessageRow(1, "dugo čekam", "2026-06-07T12:00:01.000Z")],
      phase: "waiting",
    });
    const mental = foldGuestMentalModel(input);

    expect(mental.affect.frustration.level).toBe("mild");

    const pairingGate = gateProactiveNudge({
      mental,
      candidate: { kind: "drink_pairing", message: "test" },
      config: input.config,
    });
    expect(pairingGate.allow).toBe(false);
    expect(pairingGate.reason).toBe("gmm.frustration_mild");

    const waiterGate = gateProactiveNudge({
      mental,
      candidate: { kind: "waiter_gap", message: "test" },
      config: input.config,
    });
    expect(waiterGate.allow).toBe(true);
  });

  it("blocks all proactive nudges when frustration is high", () => {
    const input = buildMentalModelFoldInput({
      timeline: [
        guestMessageRow(1, "ČEKAM???", "2026-06-07T12:00:01.000Z"),
        guestMessageRow(2, "gde je hrana", "2026-06-07T12:00:02.000Z"),
        guestMessageRow(3, "gde je hrana", "2026-06-07T12:00:03.000Z"),
      ],
      phase: "waiting",
    });
    const mental = foldGuestMentalModel(input);

    expect(mental.affect.frustration.level).toBe("high");

    const browseGate = gateProactiveNudge({
      mental,
      candidate: { kind: "browse_nudge", message: "test" },
      config: CONCIERGE_PLATFORM_DEFAULTS,
    });
    expect(browseGate.allow).toBe(false);
    expect(browseGate.reason).toBe("gmm.frustration_high");

    const waiterGate = gateProactiveNudge({
      mental,
      candidate: { kind: "waiter_gap", message: "test" },
      config: CONCIERGE_PLATFORM_DEFAULTS,
    });
    expect(waiterGate.allow).toBe(false);
    expect(waiterGate.reason).toBe("gmm.frustration_high");
  });
});
