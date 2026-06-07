import { describe, expect, it } from "vitest";
import { buildConversationThreadEvidence } from "@/lib/denis/cognition/context/retrievers/conversation-thread";
import { buildDialogueFrameEvidence } from "@/lib/denis/cognition/context/retrievers/dialogue-frame";
import { leadershipFallbackReply } from "@/lib/ai/conversation-leadership";
import { compileBeliefs } from "@/lib/denis/cognition/beliefs";
import { emptyConversationModel } from "@/lib/denis/cognition/conversation/empty-conversation-model";
import { emptyBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import { emptyGuestMentalModel } from "@/lib/denis/cognition/mental-model/empty-mental-model";
import { emptyGuestOfferContext } from "@/lib/denis/cognition/offer/empty-guest-offer-context";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import type { TableSessionState } from "@/lib/denis/loop/types";

function minimalState(
  partial: Partial<TableSessionState> = {}
): TableSessionState {
  return {
    table: { id: "t1", name: "Bar 2", token: "tok" },
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
      cart: {
        visibleLines: [],
        ai: { draft: { items: [], cartRevision: 0 } },
        manual: null,
        peerManual: null,
      },
    },
    venue: {
      ops: {
        operatingMode: "normal",
        kdsStress: "low",
        rush: false,
        skipUpsell: false,
      },
      opsEffects: { skipUpsell: false },
    },
    conversation: {
      flowNodeId: "welcome",
      foodUpsellAsked: false,
      dismissedNudges: [],
      lastAssistantMessage: "Da li ste odlučili?",
      pendingSlot: null,
      model: emptyConversationModel(),
      obligation: null,
    },
    timeline: [],
    browse: emptyBrowseProfile(),
    mental: emptyGuestMentalModel(),
    offer: emptyGuestOfferContext(),
    config: CONCIERGE_PLATFORM_DEFAULTS,
    ...partial,
  } as TableSessionState;
}

describe("conversation thread evidence", () => {
  it("summarizes live dialogue for LLM continuity", () => {
    const block = buildConversationThreadEvidence({
      transcript: [
        { role: "assistant", content: "Dobrodošli! Da li ste odlučili?" },
        { role: "user", content: "još gledamo" },
      ],
    });

    expect(block).toContain("CONVERSATION THREAD");
    expect(block).toContain("last_guest_said: još gledamo");
    expect(block).toContain("denis_awaiting_reply: yes");
  });

  it("dialogue frame prefers transcript over stale fold field", () => {
    const beliefs = compileBeliefs({
      state: minimalState(),
      guestMessage: "još gledamo",
      sessionLanguage: "sr",
    });

    const block = buildDialogueFrameEvidence({
      beliefs,
      state: minimalState({
        conversation: {
          flowNodeId: "welcome",
          foodUpsellAsked: false,
          dismissedNudges: [],
          lastAssistantMessage: "stale message",
          pendingSlot: null,
          model: emptyConversationModel(),
      obligation: null,
        },
      }),
      transcript: [
        { role: "assistant", content: "Dobrodošli! Da li ste odlučili?" },
        { role: "user", content: "još gledamo" },
      ],
    });

    expect(block).toContain("last_guest_message: još gledamo");
    expect(block).toContain("last_denis_message: Dobrodošli!");
    expect(block).not.toContain("stale message");
  });

  it("leadership fallback continues thread when history exists", () => {
    const reply = leadershipFallbackReply("sr", "još gledamo", {
      hasPriorMessages: true,
    });
    expect(reply).toContain("još gledamo");
    expect(reply).not.toContain("dobrodošli");
  });
});
