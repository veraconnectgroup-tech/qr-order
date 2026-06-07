import { describe, expect, it } from "vitest";
import { buildMentalModelGatePayload } from "@/lib/denis/cognition/mental-model/mental-model-timeline";
import { buildProactiveEmittedPayload } from "@/lib/denis/cognition/offer/build-proactive-emitted-payload";
import { emptyGuestOfferContext } from "@/lib/denis/cognition/offer/empty-guest-offer-context";
import { emptyGuestMentalModel } from "@/lib/denis/cognition/mental-model/empty-mental-model";
import { PROACTIVE_POLICY_VERSION } from "@/lib/denis/cognition/proactive/proactive-policy-defaults";
import type { TableSessionState } from "@/lib/denis/loop/types";

function minimalState(timingKind: "browse_pause" | "none" = "browse_pause"): TableSessionState {
  const offer = emptyGuestOfferContext();
  offer.trace.timing = {
    kind: timingKind,
    idleSinceBrowseSec: 12,
    speakWindow: timingKind === "none" ? "closed" : "open",
    ready: timingKind !== "none",
    reason: timingKind === "none" ? "not_ready_posture" : "browse_pause",
  };

  return {
    mental: emptyGuestMentalModel(),
    offer,
  } as TableSessionState;
}

describe("UPDS audit payloads", () => {
  it("mental_model.gate includes evaluationChain and timingKind", () => {
    const payload = buildMentalModelGatePayload({
      mental: emptyGuestMentalModel(),
      mode: "enforce",
      candidateKind: "browse_nudge",
      allow: false,
      enforced: true,
      reason: "gmm.offer_not_ready",
      wouldBlock: true,
      evaluationChain: [
        { kind: "browse_nudge", allow: false, reason: "gmm.offer_not_ready" },
        { kind: "guest_welcome", allow: false, reason: "gmm.intent_incompatible" },
      ],
      timingKind: "browse_pause",
      topRankedKind: "browse_nudge",
      selectedKind: null,
      source: "session.watcher",
      policyVersion: PROACTIVE_POLICY_VERSION,
    });

    expect(payload.evaluationChain).toHaveLength(2);
    expect(payload.timingKind).toBe("browse_pause");
    expect(payload.policyVersion).toBe("gmm-v1");
    expect(payload.source).toBe("session.watcher");
  });

  it("proactive.emitted includes timingKind from offer trace", () => {
    const payload = buildProactiveEmittedPayload({
      state: minimalState("browse_pause"),
      nudge: { kind: "browse_nudge", message: "Pomoć?" },
      message: "Pomoć?",
      source: "session.watcher",
    });

    expect(payload.timingKind).toBe("browse_pause");
  });
});
