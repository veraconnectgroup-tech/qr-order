import { describe, expect, it } from "vitest";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import {
  belief,
  beliefGraph,
  decideTurnPlan,
  isCasualSocialGuestMessage,
  looksLikeOrderLine,
  planUtterance,
  resolveTemplateLocale,
  tryTemplateUtterance,
  turnPlanAllowsUpsell,
  utteranceIncludesUpsellNudge,
} from "@/lib/denis/cognition/tde";
import { matchesT0SlotAnswer } from "@/lib/denis/cognition/tde/slot-response-match";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";
import { deriveGoalStack, topGoal } from "@/lib/denis/kernel/goal-stack";
import { planTurnWithReflex as reflexPlan } from "@/lib/denis/kernel/reflex-plan";
import { isT0Confirm, resolveT0Reflex } from "@/lib/denis/kernel/reflex-rules";

const config = CONCIERGE_PLATFORM_DEFAULTS;

function reflexFor(
  message: string,
  flowNodeId: "collect" | "browse" | "recap" = "collect",
  cartState = emptyCartState()
) {
  return reflexPlan({
    config,
    message,
    flowNodeId,
    cartState,
    skipUpsell: false,
  });
}

describe("decideTurnPlan — ADR-025 state-driven routing", () => {
  it("routes banter belief to transactional when not pure social (comprehend-first)", () => {
    const beliefs = beliefGraph([
      belief("conversation.mode", "banter"),
      belief("conversation.language", "sr"),
    ]);
    const plan = decideTurnPlan({
      beliefs,
      reflex: reflexFor("gde si legendo"),
      message: "gde si legendo",
    });
    expect(plan.kind).toBe("transactional_perceive");
    expect(plan.requiresLlm).toBe(true);
  });

  it("routes Zdravo Denise legendo to transactional comprehend-first", () => {
    const beliefs = beliefGraph([
      belief("conversation.mode", "banter"),
      belief("conversation.language", "sr"),
    ]);
    const plan = decideTurnPlan({
      beliefs,
      reflex: reflexFor("Zdravo Denise legendo", "browse"),
      message: "Zdravo Denise legendo",
    });
    expect(plan.kind).toBe("transactional_perceive");
    expect(plan.requiresLlm).toBe(true);
  });

  it("routes Daj mi sok with ordering belief to transactional_perceive", () => {
    const beliefs = beliefGraph([
      belief("conversation.mode", "ordering"),
      belief("conversation.language", "sr"),
    ]);
    const plan = decideTurnPlan({
      beliefs,
      reflex: reflexFor("Daj mi sok"),
      message: "Daj mi sok",
    });
    expect(plan.kind).toBe("transactional_perceive");
    expect(plan.requiresLlm).toBe(true);
  });

  it("routes order line with ordering mode to transactional_perceive", () => {
    const beliefs = beliefGraph([
      belief("conversation.mode", "ordering"),
      belief("conversation.language", "de"),
    ]);
    const message = "zwei pils und ein schnitzel";
    expect(looksLikeOrderLine(message)).toBe(true);
    const plan = decideTurnPlan({
      beliefs,
      reflex: reflexFor(message),
      message,
    });
    expect(plan.kind).toBe("transactional_perceive");
    expect(plan.requiresLlm).toBe(true);
  });

  it("ordering belief + hello uses transactional_perceive, not banter", () => {
    const beliefs = beliefGraph([
      belief("conversation.mode", "ordering"),
      belief("conversation.language", "sr"),
    ]);
    const plan = decideTurnPlan({
      beliefs,
      reflex: reflexFor("hello"),
      message: "hello",
    });
    expect(plan.kind).toBe("transactional_perceive");
  });

  it("pure social greeting stays relational", () => {
    const plan = decideTurnPlan({
      beliefs: beliefGraph([
        belief("conversation.mode", "banter"),
        belief("commerce.pressure", "none"),
      ]),
      reflex: reflexFor("Zdravo kako si"),
      message: "Zdravo kako si",
    });
    expect(plan.kind).toBe("relational_perceive");
  });

  it("casual social without commerce pressure uses transactional comprehend-first", () => {
    expect(isCasualSocialGuestMessage("gde si legendo")).toBe(true);
    const plan = decideTurnPlan({
      beliefs: beliefGraph([]),
      reflex: reflexFor("gde si legendo", "browse"),
      message: "gde si legendo",
    });
    expect(plan.kind).toBe("transactional_perceive");
  });

  it("status query without open orders uses status.no_order template", () => {
    const plan = decideTurnPlan({
      beliefs: beliefGraph([
        belief("conversation.language", "sr"),
        belief("commerce.has_open_orders", false),
      ]),
      reflex: reflexFor("Kad stiže moje pivo"),
      message: "Kad stiže moje pivo",
    });
    expect(plan.kind).toBe("template_tell");
    expect(plan.templateKey).toBe("status.no_order");
    expect(plan.requiresLlm).toBe(false);
  });

  it("status query with open orders uses live status template (0 LLM)", () => {
    const plan = decideTurnPlan({
      beliefs: beliefGraph([
        belief("conversation.language", "sr"),
        belief("commerce.has_open_orders", true),
      ]),
      reflex: reflexFor("Kad stiže moj burger"),
      message: "Kad stiže moj burger",
    });
    expect(plan.kind).toBe("template_tell");
    expect(plan.reason).toBe("commerce.status.open_order");
    expect(plan.requiresLlm).toBe(false);
  });

  it("order-not-sent complaint without open orders uses status.no_order template", () => {
    const plan = decideTurnPlan({
      beliefs: beliefGraph([
        belief("conversation.language", "sr"),
        belief("commerce.has_open_orders", false),
      ]),
      reflex: reflexFor("Konobar kaže da nisi poslao order"),
      message: "Konobar kaže da nisi poslao order",
    });
    expect(plan.kind).toBe("template_tell");
    expect(plan.templateKey).toBe("status.no_order");
    expect(plan.requiresLlm).toBe(false);
  });

  it("hvala with open cart pressure stays transactional, not settle template", () => {
    const plan = decideTurnPlan({
      beliefs: beliefGraph([
        belief("conversation.mode", "ordering"),
        belief("commerce.pressure", "open"),
      ]),
      reflex: reflexFor("hvala"),
      message: "hvala",
    });
    expect(plan.kind).toBe("transactional_perceive");
    expect(plan.requiresLlm).toBe(true);
  });
});

describe("decideTurnPlan — slots and reflex", () => {
  it("pending_slot + velika (T0 label) → transactional_perceive (LLM applies size)", () => {
    const plan = decideTurnPlan({
      beliefs: beliefGraph([
        belief("commerce.pending_slot", "serve_size"),
        belief("conversation.mode", "ordering"),
      ]),
      reflex: reflexFor("velika"),
      message: "velika",
    });
    expect(plan.kind).toBe("transactional_perceive");
    expect(plan.requiresLlm).toBe(true);
    expect(plan.reason).toBe("commerce.pending_slot.reply");
  });

  it("pending_slot + veliko pivo → transactional_perceive (not template loop)", () => {
    const plan = decideTurnPlan({
      beliefs: beliefGraph([
        belief("commerce.pending_slot", "serve_size"),
        belief("conversation.mode", "ordering"),
      ]),
      reflex: reflexFor("Pa veliko pivo"),
      message: "Pa veliko pivo",
    });
    expect(plan.kind).toBe("transactional_perceive");
    expect(plan.requiresLlm).toBe(true);
  });

  it("pending_slot never returns slot_extract template (ADR-031 C2)", () => {
    const plan = decideTurnPlan({
      beliefs: beliefGraph([
        belief("commerce.pending_slot", "serve_size"),
      ]),
      reflex: reflexFor("???"),
      message: "???",
    });
    expect(plan.kind).not.toBe("slot_extract");
    expect(plan.kind).toBe("transactional_perceive");
  });

  it("pending_slot + 0.5 → transactional_perceive", () => {
    const plan = decideTurnPlan({
      beliefs: beliefGraph([
        belief("commerce.pending_slot", "serve_size"),
        belief("conversation.mode", "ordering"),
      ]),
      reflex: reflexFor("0.5"),
      message: "0.5",
    });
    expect(plan.kind).toBe("transactional_perceive");
    expect(plan.requiresLlm).toBe(true);
  });

  it("Veliko povo typo with ordering belief → transactional_perceive", () => {
    const plan = decideTurnPlan({
      beliefs: beliefGraph([
        belief("conversation.mode", "ordering"),
        belief("commerce.pending_slot", "serve_size"),
      ]),
      reflex: reflexFor("Veliko povo"),
      message: "Veliko povo",
    });
    expect(plan.kind).toBe("transactional_perceive");
    expect(plan.templateKey).toBeUndefined();
  });

  it("T0 da on recap → LLM comprehend confirm (ADR-030)", () => {
    const reflex = reflexFor("da", "recap");
    expect(reflex.usedT0).toBe(true);
    const plan = decideTurnPlan({
      beliefs: beliefGraph([
        belief("commerce.pressure", "confirm"),
      ]),
      reflex,
      message: "da",
    });
    expect(plan.kind).toBe("transactional_perceive");
    expect(plan.requiresLlm).toBe(true);
  });

  it("Može on recap → T0 confirm (contextual reflex)", () => {
    expect(isT0Confirm("Može", { awaitingConfirm: true })).toBe(true);
    const reflex = reflexFor("Može", "recap");
    expect(reflex.usedT0).toBe(true);
    const plan = decideTurnPlan({
      beliefs: beliefGraph([
        belief("commerce.pressure", "confirm"),
        belief("conversation.awaiting", "confirm"),
      ]),
      reflex,
      message: "Može",
    });
    expect(plan.kind).toBe("transactional_perceive");
    expect(plan.requiresLlm).toBe(true);
    expect(plan.reason).toBe("commerce.awaiting_confirm.comprehend");
  });

  it("potvrdjujem on recap → T0 confirm", () => {
    expect(isT0Confirm("potvrdjujem", { awaitingConfirm: true })).toBe(true);
    const reflex = reflexFor("potvrdjujem", "recap");
    expect(reflex.usedT0).toBe(true);
    expect(reflex.reflex?.intent).toBe("CONFIRM");
  });

  it("Može without confirm context is not T0", () => {
    expect(isT0Confirm("Može")).toBe(false);
    expect(resolveT0Reflex("Može")).toBeNull();
  });
});

describe("slot-response-match", () => {
  it("matches T0 volume and size labels only", () => {
    expect(matchesT0SlotAnswer("serve_size", "0.5")).toBe(true);
    expect(matchesT0SlotAnswer("serve_size", "velika")).toBe(true);
    expect(matchesT0SlotAnswer("serve_size", "Pa veliko pivo")).toBe(false);
    expect(matchesT0SlotAnswer("serve_size", "Veliko povo")).toBe(false);
  });
});

describe("decideTurnPlan — rush suppresses upsell", () => {
  it("venue.rush / skip_upsell sets suppressUpsell and blocks upsell goals", () => {
    const beliefs = beliefGraph([
      belief("venue.rush", true, "ops"),
      belief("venue.skip_upsell", true, "ops"),
      belief("conversation.mode", "ordering"),
    ]);
    const plan = decideTurnPlan({
      beliefs,
      reflex: reflexFor("2x cola"),
      message: "2x cola",
    });
    expect(plan.suppressUpsell).toBe(true);
    expect(turnPlanAllowsUpsell(plan, { type: "UPSELL_ONCE", category: "food", priority: 40 })).toBe(
      false
    );

    const goals = deriveGoalStack({
      flowNodeId: "upsell_food",
      pendingSlot: null,
      cartConflict: false,
      foodUpsellAsked: false,
      hasOpenOrders: false,
      lastIntent: "ORDER",
      skipUpsell: true,
    });
    const upsellGoal = topGoal(goals);
    expect(upsellGoal?.type).not.toBe("UPSELL_ONCE");

    const utterance = planUtterance({
      beliefs,
      turnPlan: plan,
      topGoal: upsellGoal,
    });
    expect(utteranceIncludesUpsellNudge({ beliefs, turnPlan: plan, topGoal: upsellGoal })).toBe(
      false
    );
    expect(utterance.facts.suppressUpsell).toBe(true);
  });
});

describe("planUtterance + template-utterance", () => {
  it("banter template still works when explicitly planned", () => {
    for (const lang of ["sr", "de", "en"] as const) {
      const beliefs = beliefGraph([
        belief("conversation.mode", "banter"),
        belief("conversation.language", lang),
      ]);
      const utterance = planUtterance({
        beliefs,
        turnPlan: {
          kind: "template_tell",
          requiresLlm: false,
          suppressUpsell: false,
          reason: "test",
          templateKey: "banter.welcome",
        },
        topGoal: null,
      });
      expect(utterance.useTemplate).toBe(true);
      const text = tryTemplateUtterance(utterance);
      expect(text).toBeTruthy();
      expect(resolveTemplateLocale(lang)).toBe(lang);
    }
  });

  it("returns localized banter string for Serbian", () => {
    const utterance = planUtterance({
      beliefs: beliefGraph([belief("conversation.language", "sr")]),
      turnPlan: {
        kind: "template_tell",
        requiresLlm: false,
        suppressUpsell: false,
        reason: "test",
        templateKey: "banter.welcome",
      },
      topGoal: null,
    });
    const text = tryTemplateUtterance(utterance);
    expect(text).toMatch(/Dobar dan|dobrodošli|mogu pomoći/i);
  });
});
