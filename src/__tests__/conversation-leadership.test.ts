import { describe, expect, it } from "vitest";
import {
  applyConversationLeadership,
  isCasualSocialGuestMessage,
  isDenisRefusalReply,
  leadershipFallbackReply,
} from "@/lib/ai/conversation-leadership";

describe("conversation leadership", () => {
  it("detects German refusal replies", () => {
    expect(
      isDenisRefusalReply(
        "Entschuldigung, ich verstehe nicht ganz. Darf ich auf Deutsch fortfahren?"
      )
    ).toBe(true);
    expect(
      isDenisRefusalReply(
        "Entschuldigung, ich kann nur auf Deutsch oder Englisch antworten."
      )
    ).toBe(true);
  });

  it("detects English parse fallback as refusal", () => {
    expect(isDenisRefusalReply("Sorry, I didn't catch that — could you try again?")).toBe(
      true
    );
  });

  it("detects Serbian refusal replies", () => {
    expect(isDenisRefusalReply("Izvinite, ne razumem. Možete li ponoviti?")).toBe(
      true
    );
    expect(isDenisRefusalReply("Ne razumijem, molim vas ponovite.")).toBe(true);
  });

  it("does not flag normal order clarify", () => {
    expect(isDenisRefusalReply("0,3L oder 0,5L?")).toBe(false);
  });

  it("treats casual Serbian banter as social", () => {
    expect(isCasualSocialGuestMessage("Denis legendo gde si sta si")).toBe(true);
    expect(isCasualSocialGuestMessage("1x Cola please")).toBe(false);
  });

  it("rewrites refusal to leadership reply in Serbian", () => {
    const out = applyConversationLeadership(
      {
        intent: "clarify",
        message:
          "Entschuldigung, ich kann nur auf Deutsch oder Englisch antworten.",
        recommendations: [],
        proposedItems: [],
        quickReplies: [],
        submitOrder: false,
      },
      {
        language: "sr",
        guestMessage: "nein weiter nur auf serbisch",
      }
    );
    expect(out.intent).toBe("chat");
    expect(out.message).toContain("Tu sam");
    expect(isDenisRefusalReply(out.message)).toBe(false);
  });

  it("rewrites Serbian ne razumem to leadership banter", () => {
    const out = applyConversationLeadership(
      {
        intent: "clarify",
        message: "Izvinite, ne razumem. Možete li ponoviti?",
        recommendations: [],
        proposedItems: [],
        quickReplies: [],
        submitOrder: false,
      },
      {
        language: "sr",
        guestMessage: "Denis legendo gde si",
      }
    );
    expect(out.intent).toBe("chat");
    expect(out.message).toMatch(/Tu sam|piće|jelo/i);
    expect(isDenisRefusalReply(out.message)).toBe(false);
  });

  it("rewrites misclassified social clarify when not in ordering context", () => {
    const out = applyConversationLeadership(
      {
        intent: "clarify",
        message: "Could you repeat that?",
        recommendations: [],
        proposedItems: [],
        quickReplies: [],
        submitOrder: false,
      },
      {
        language: "sr",
        guestMessage: "Denis legendo gde si",
      }
    );
    expect(out.intent).toBe("chat");
    expect(out.message).toMatch(/Tu sam|piće|jelo/i);
  });

  it("preserves clarify during ordering flow (ADR-030)", () => {
    const out = applyConversationLeadership(
      {
        intent: "clarify",
        message: "Veliko od 0,5L — da potvrdim?",
        recommendations: [],
        proposedItems: [],
        quickReplies: [],
        submitOrder: false,
      },
      {
        language: "sr",
        guestMessage: "Veliko povo",
        context: {
          inOrderingFlow: true,
          awaitingAnswer: true,
          transactionalTurn: true,
        },
      }
    );
    expect(out.intent).toBe("clarify");
    expect(out.message).toContain("0,5L");
    expect(out.message).not.toMatch(/^Tu sam!/i);
  });

  it("provides German leadership fallback", () => {
    expect(leadershipFallbackReply("de")).toMatch(/Ich bin da/i);
  });
});
