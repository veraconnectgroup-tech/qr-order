import { describe, expect, it } from "vitest";
import {
  applyConversationLeadership,
  isCasualSocialGuestMessage,
  isDenisRefusalReply,
  leadershipFallbackReply,
  orderingContinueReply,
  politeReengageReply,
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

  it("treats product choice replies as ordering, not social", () => {
    expect(isCasualSocialGuestMessage("Weizen molim te")).toBe(false);
    expect(isCasualSocialGuestMessage("Pilsner molim")).toBe(false);
  });

  it("rewrites refusal to polite re-engage in Serbian (no welcome reset)", () => {
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
    expect(out.message).toMatch(/Tu sam|mogu pomoći|želeli/i);
    expect(out.message).not.toMatch(/dobrodošli|Dobar dan i/i);
    expect(isDenisRefusalReply(out.message)).toBe(false);
  });

  it("rewrites Serbian ne razumem to polite re-engage without welcome", () => {
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
    expect(out.message).toBe(politeReengageReply("sr"));
    expect(out.message).not.toMatch(/dobrodošli|Dobar dan i/i);
    expect(isDenisRefusalReply(out.message)).toBe(false);
  });

  it("preserves LLM clarify for casual social messages (ADR-025)", () => {
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
    expect(out.intent).toBe("clarify");
    expect(out.message).toBe("Could you repeat that?");
  });

  it("preserves normal ordering LLM reply without leadership rewrite", () => {
    const structured = {
      intent: "order" as const,
      message: "Odlično — dodajem Pilsner 0,5L u porudžbinu.",
      recommendations: [],
      proposedItems: [
        {
          productId: "p-pils",
          quantity: 1,
          modifierIds: [],
          serveSize: "0.5L",
          notes: "",
        },
      ],
      quickReplies: [],
      submitOrder: false,
    };
    const out = applyConversationLeadership(structured, {
      language: "sr",
      guestMessage: "Pilsner 0.5",
      context: { inOrderingFlow: true, conversationMode: "ordering" },
    });
    expect(out).toEqual(structured);
  });

  it("uses ordering continue reply for refusal during commerce pressure", () => {
    const out = applyConversationLeadership(
      {
        intent: "clarify",
        message: "Izvinite, ne razumem šta želite.",
        recommendations: [],
        proposedItems: [],
        quickReplies: [],
        submitOrder: false,
      },
      {
        language: "sr",
        guestMessage: "Daj mi sok",
        context: {
          conversationMode: "ordering",
          inOrderingFlow: true,
          commercePressure: "open",
        },
      }
    );
    expect(out.intent).toBe("clarify");
    expect(out.message).toBe(orderingContinueReply("sr"));
    expect(out.message).toMatch(/nastavimo|šta želite/i);
    expect(out.message).not.toMatch(/dobrodošli|Dobar dan i/i);
  });

  it("uses German ordering continue for refusal with awaiting context", () => {
    const out = applyConversationLeadership(
      {
        intent: "confirm",
        message: "Entschuldigung, ich verstehe nicht.",
        recommendations: [],
        proposedItems: [],
        quickReplies: [],
        submitOrder: false,
      },
      {
        language: "de",
        guestMessage: "ja",
        context: {
          awaitingAnswer: true,
          commercePressure: "confirm",
        },
      }
    );
    expect(out.intent).toBe("confirm");
    expect(out.message).toBe(orderingContinueReply("de"));
    expect(out.message).toMatch(/weitermachen|bestellen/i);
  });

  it("preserves clarify during ordering flow when LLM did not refuse (ADR-030)", () => {
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
    expect(out.message).not.toMatch(/^Dobar dan/i);
  });

  it("provides German leadership fallback without willkommen reset", () => {
    expect(leadershipFallbackReply("de")).toMatch(/Ihnen helfen/i);
    expect(leadershipFallbackReply("de")).not.toMatch(/willkommen/i);
  });

  it("does not reset to welcome on parse fallback for add-more order line", () => {
    const out = applyConversationLeadership(
      {
        intent: "chat",
        message: "Sorry, I didn't catch that — could you try again?",
        recommendations: [],
        proposedItems: [],
        quickReplies: [],
        submitOrder: false,
      },
      {
        language: "sr",
        guestMessage:
          "dobro dodaj mi i kiselu vodu, za moju suprugu pileci burger bez priloga i jedan cevap",
        context: {
          hasPriorMessages: true,
        },
      }
    );
    expect(out.intent).toBe("clarify");
    expect(out.message).not.toMatch(/^Dobar dan i dobrodošli/i);
    expect(out.message).toMatch(/Razumem|pomoći|dodam/i);
  });

  it("guides order continuation instead of welcome for hajde da nastavimo", () => {
    const out = applyConversationLeadership(
      {
        intent: "chat",
        message: "Sorry, I didn't catch that — could you try again?",
        recommendations: [],
        proposedItems: [],
        quickReplies: [],
        submitOrder: false,
      },
      {
        language: "sr",
        guestMessage: "okej hajde da nastavimo",
        context: {
          inOrderingFlow: true,
          hasPriorMessages: true,
        },
      }
    );
    expect(out.message).toMatch(/nastavimo|šta želite/i);
    expect(out.message).not.toMatch(/^Dobar dan i dobrodošli/i);
  });

  it("does not reset to welcome on parse fallback mid-order (Weizen reply)", () => {
    const out = applyConversationLeadership(
      {
        intent: "chat",
        message: "Sorry, I didn't catch that — could you try again?",
        recommendations: [],
        proposedItems: [],
        quickReplies: [],
        submitOrder: false,
      },
      {
        language: "sr",
        guestMessage: "Weizen molim te",
        context: {
          inOrderingFlow: true,
          transactionalTurn: true,
        },
      }
    );
    expect(out.intent).toBe("clarify");
    expect(out.message).toMatch(/nastavimo|šta želite/i);
    expect(out.message).not.toMatch(/^Dobar dan i dobrodošli/i);
  });
});
