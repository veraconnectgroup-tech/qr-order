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
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";
import { deriveGoalStack, topGoal } from "@/lib/denis/kernel/goal-stack";
import { planTurnWithReflex as reflexPlan } from "@/lib/denis/kernel/reflex-plan";

const config = CONCIERGE_PLATFORM_DEFAULTS;

function reflexFor(message: string, flowNodeId: "collect" | "browse" | "recap" = "collect") {
  return reflexPlan({
    config,
    message,
    flowNodeId,
    cartState: emptyCartState(),
    skipUpsell: false,
  });
}

describe("decideTurnPlan — banter vs order", () => {
  it("routes banter belief to template or relational, never transactional JSON", () => {
    const beliefs = beliefGraph([
      belief("conversation.mode", "banter"),
      belief("conversation.language", "sr"),
    ]);
    const plan = decideTurnPlan({
      beliefs,
      reflex: reflexFor("gde si legendo"),
      message: "gde si legendo",
    });
    expect(plan.kind).not.toBe("transactional_perceive");
    expect(["template_tell", "relational_perceive"]).toContain(plan.kind);
  });

  it("treats casual social message as banter without explicit belief", () => {
    expect(isCasualSocialGuestMessage("gde si legendo")).toBe(true);
    const plan = decideTurnPlan({
      beliefs: beliefGraph([]),
      reflex: reflexFor("gde si legendo", "browse"),
      message: "gde si legendo",
    });
    expect(plan.kind).not.toBe("transactional_perceive");
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
});

describe("decideTurnPlan — slots and reflex", () => {
  it("pending_slot belief → slot_extract", () => {
    const plan = decideTurnPlan({
      beliefs: beliefGraph([
        belief("commerce.pending_slot", "serve_size"),
      ]),
      reflex: reflexFor("velika"),
      message: "velika",
    });
    expect(plan.kind).toBe("slot_extract");
    expect(plan.requiresLlm).toBe(false);
    expect(plan.templateKey).toBe("slot.clarify.serve_size");
  });

  it("T0 confirm → reflex_only without LLM", () => {
    const reflex = reflexFor("da", "recap");
    expect(reflex.usedT0).toBe(true);
    const plan = decideTurnPlan({
      beliefs: beliefGraph([]),
      reflex,
      message: "da",
    });
    expect(plan.kind).toBe("reflex_only");
    expect(plan.requiresLlm).toBe(false);
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
  it("banter template covers sr, de, en", () => {
    for (const lang of ["sr", "de", "en"] as const) {
      const beliefs = beliefGraph([
        belief("conversation.mode", "banter"),
        belief("conversation.language", lang),
      ]);
      const turnPlan = decideTurnPlan({
        beliefs,
        reflex: reflexFor("hey"),
        message: "hey",
      });
      const utterance = planUtterance({
        beliefs,
        turnPlan,
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
    expect(text).toMatch(/Tu sam/i);
  });
});
