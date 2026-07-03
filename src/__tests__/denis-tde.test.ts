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
  type TurnPlanKind,
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

type ComprehensionScenarioContext = {
  awaitingConfirm?: boolean;
  ordering?: boolean;
  settling?: boolean;
};

type ComprehensionScenario = {
  msg: string;
  expect: TurnPlanKind;
  templateKey?: string;
  ctx?: ComprehensionScenarioContext;
};

function beliefsForScenario(ctx?: ComprehensionScenarioContext) {
  if (ctx?.awaitingConfirm) {
    return beliefGraph([
      belief("commerce.pressure", "confirm"),
      belief("conversation.awaiting", "confirm"),
      belief("waiter.can_confirm", true),
      belief("waiter.gap_count", 0),
    ]);
  }
  if (ctx?.ordering) {
    return beliefGraph([
      belief("conversation.mode", "ordering"),
      belief("commerce.pressure", "none"),
    ]);
  }
  if (ctx?.settling) {
    return beliefGraph([
      belief("conversation.mode", "settling"),
      belief("commerce.pressure", "none"),
    ]);
  }
  return beliefGraph([
    belief("conversation.mode", "banter"),
    belief("commerce.pressure", "none"),
  ]);
}

function planForComprehensionScenario(scenario: ComprehensionScenario) {
  const flowNodeId = scenario.ctx?.awaitingConfirm ? "recap" : "browse";
  return decideTurnPlan({
    beliefs: beliefsForScenario(scenario.ctx),
    reflex: reflexFor(scenario.msg, flowNodeId),
    message: scenario.msg,
  });
}

function expectedRequiresLlm(kind: TurnPlanKind): boolean {
  if (kind === "reflex_only") return false;
  return true;
}

describe("decideTurnPlan — guest comprehension eval (regression guard)", () => {
  const llmScenarios: ComprehensionScenario[] = [
    { msg: "šta imate?", expect: "transactional_perceive" },
    { msg: "daj mi sok", ctx: { ordering: true }, expect: "transactional_perceive" },
    { msg: "kako se zove ovo jelo?", expect: "relational_perceive" },
    { msg: "Može", ctx: { awaitingConfirm: false }, expect: "relational_perceive" },
    { msg: "Merhaba", expect: "relational_perceive" },
    { msg: "Que tal", expect: "relational_perceive" },
    { msg: "gde si legendo", expect: "relational_perceive" },
    { msg: "šta preporučuješ?", expect: "relational_perceive" },
    { msg: "imam alergiju na kikiriki", expect: "relational_perceive" },
    { msg: "koliko košta burger?", expect: "relational_perceive" },
    { msg: "jel ima nešto veganski?", expect: "relational_perceive" },
    { msg: "a šta je Weizen?", expect: "relational_perceive" },
    { msg: "daj nešto hladno", expect: "relational_perceive" },
    { msg: "povo", ctx: { ordering: true }, expect: "transactional_perceive" },
  ];

  const reflexScenarios: ComprehensionScenario[] = [
    { msg: "da", ctx: { awaitingConfirm: true }, expect: "reflex_only" },
    { msg: "Može", ctx: { awaitingConfirm: true }, expect: "reflex_only" },
    { msg: "pošalji", ctx: { awaitingConfirm: true }, expect: "reflex_only" },
  ];

  const templateScenarios: ComprehensionScenario[] = [
    {
      msg: "hvala, to je sve",
      expect: "template_tell",
      templateKey: "settle.thanks",
    },
    {
      msg: "danke schön",
      expect: "template_tell",
      templateKey: "settle.thanks",
    },
  ];

  it.each(llmScenarios)(
    "comprehends guest message via LLM: $msg → $expect",
    (scenario) => {
      const plan = planForComprehensionScenario(scenario);
      expect(plan.kind).toBe(scenario.expect);
      expect(plan.requiresLlm).toBe(expectedRequiresLlm(scenario.expect));
      expect(plan.templateKey).not.toBe("banter.welcome");
    }
  );

  it.each(reflexScenarios)(
    "T0 reflex at recap: $msg → $expect",
    (scenario) => {
      const plan = planForComprehensionScenario(scenario);
      expect(plan.kind).toBe(scenario.expect);
      expect(plan.requiresLlm).toBe(false);
      expect(plan.templateKey).not.toBe("banter.welcome");
    }
  );

  it.each(templateScenarios)(
    "system fact template: $msg → $templateKey",
    (scenario) => {
      const plan = planForComprehensionScenario(scenario);
      expect(plan.kind).toBe(scenario.expect);
      expect(plan.requiresLlm).toBe(true);
      expect(plan.templateKey).toBe(scenario.templateKey);
    }
  );

  it("comprehends seated order line before welcome/banter path", () => {
    const plan = decideTurnPlan({
      beliefs: beliefGraph([
        belief("conversation.mode", "banter"),
        belief("commerce.pressure", "none"),
      ]),
      reflex: reflexFor("Jedno veliko pivo weizen", "browse"),
      message: "Jedno veliko pivo weizen",
    });
    expect(plan.kind).toBe("transactional_perceive");
    expect(plan.reason).toMatch(/^comprehend_first\.order_line(\.llm_reply)?$/);
    expect(plan.requiresLlm).toBe(true);
    expect(plan.templateKey).not.toBe("banter.welcome");
  });

  it("never returns banter.welcome for any guest comprehension scenario", () => {
    const all = [...llmScenarios, ...reflexScenarios, ...templateScenarios];
    for (const scenario of all) {
      const plan = planForComprehensionScenario(scenario);
      expect(plan.templateKey).not.toBe("banter.welcome");
    }
  });
});

describe("decideTurnPlan — ADR-025 state-driven routing", () => {
  it("routes banter thread to relational (cheaper social tier)", () => {
    const beliefs = beliefGraph([
      belief("conversation.mode", "banter"),
      belief("conversation.language", "sr"),
    ]);
    const plan = decideTurnPlan({
      beliefs,
      reflex: reflexFor("gde si legendo"),
      message: "gde si legendo",
    });
    expect(plan.kind).toBe("relational_perceive");
    expect(plan.requiresLlm).toBe(true);
  });

  it("routes Zdravo Denise legendo to relational social perceive", () => {
    const beliefs = beliefGraph([
      belief("conversation.mode", "banter"),
      belief("conversation.language", "sr"),
    ]);
    const plan = decideTurnPlan({
      beliefs,
      reflex: reflexFor("Zdravo Denise legendo", "browse"),
      message: "Zdravo Denise legendo",
    });
    expect(plan.kind).toBe("relational_perceive");
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

  it("ordering belief + hello stays relational (social thread, not cart pressure)", () => {
    const beliefs = beliefGraph([
      belief("conversation.mode", "ordering"),
      belief("conversation.language", "sr"),
    ]);
    const plan = decideTurnPlan({
      beliefs,
      reflex: reflexFor("hello"),
      message: "hello",
    });
    expect(plan.kind).toBe("relational_perceive");
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

  it("casual social without commerce pressure uses relational perceive", () => {
    expect(isCasualSocialGuestMessage("gde si legendo")).toBe(true);
    const plan = decideTurnPlan({
      beliefs: beliefGraph([]),
      reflex: reflexFor("gde si legendo", "browse"),
      message: "gde si legendo",
    });
    expect(plan.kind).toBe("relational_perceive");
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
    expect(plan.requiresLlm).toBe(true);
  });

  it("status query with open orders uses live status template (LLM narrates facts)", () => {
    const plan = decideTurnPlan({
      beliefs: beliefGraph([
        belief("conversation.language", "sr"),
        belief("commerce.has_open_orders", true),
      ]),
      reflex: reflexFor("Kad stiže moj burger"),
      message: "Kad stiže moj burger",
    });
    expect(plan.kind).toBe("template_tell");
    expect(plan.reason).toBe("commerce.status.open_order.llm_reply");
    expect(plan.requiresLlm).toBe(true);
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
    expect(plan.requiresLlm).toBe(true);
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

  it("hvala with settling mode uses settle.thanks template", () => {
    const plan = decideTurnPlan({
      beliefs: beliefGraph([
        belief("conversation.mode", "settling"),
        belief("commerce.pressure", "none"),
      ]),
      reflex: reflexFor("hvala"),
      message: "hvala",
    });
    expect(plan.kind).toBe("template_tell");
    expect(plan.templateKey).toBe("settle.thanks");
    expect(plan.requiresLlm).toBe(true);
  });

  it("to je sve after submit closes round even when mode still ordering", () => {
    const plan = decideTurnPlan({
      beliefs: beliefGraph([
        belief("conversation.mode", "ordering"),
        belief("commerce.pressure", "none"),
        belief("commerce.has_open_orders", true),
      ]),
      reflex: reflexFor("to je sve"),
      message: "to je sve",
    });
    expect(plan.kind).toBe("template_tell");
    expect(plan.templateKey).toBe("settle.thanks");
  });

  it("Može without confirm context → relational_perceive (not banter.welcome)", () => {
    const plan = decideTurnPlan({
      beliefs: beliefGraph([
        belief("conversation.mode", "banter"),
        belief("commerce.pressure", "none"),
      ]),
      reflex: reflexFor("Može", "browse"),
      message: "Može",
    });
    expect(plan.kind).toBe("relational_perceive");
    expect(plan.requiresLlm).toBe(true);
    expect(plan.templateKey).toBeUndefined();
  });

  it("Daj mi sok without commerce pressure → relational_perceive (not template)", () => {
    const plan = decideTurnPlan({
      beliefs: beliefGraph([
        belief("conversation.mode", "banter"),
        belief("commerce.pressure", "none"),
      ]),
      reflex: reflexFor("Daj mi sok"),
      message: "Daj mi sok",
    });
    expect(["relational_perceive", "transactional_perceive"]).toContain(plan.kind);
    expect(plan.requiresLlm).toBe(true);
    expect(plan.templateKey).toBeUndefined();
  });

  it("šta imate? → LLM perceive (not template)", () => {
    const plan = decideTurnPlan({
      beliefs: beliefGraph([
        belief("conversation.mode", "banter"),
        belief("commerce.pressure", "none"),
      ]),
      reflex: reflexFor("šta imate?", "browse"),
      message: "šta imate?",
    });
    expect(plan.kind).toBe("transactional_perceive");
    expect(plan.requiresLlm).toBe(true);
    expect(plan.templateKey).toBeUndefined();
  });

  it("Zdravo Denise → relational_perceive (not banter.welcome)", () => {
    const plan = decideTurnPlan({
      beliefs: beliefGraph([
        belief("conversation.mode", "banter"),
        belief("commerce.pressure", "none"),
      ]),
      reflex: reflexFor("Zdravo Denise", "browse"),
      message: "Zdravo Denise",
    });
    expect(plan.kind).toBe("relational_perceive");
    expect(plan.requiresLlm).toBe(true);
    expect(plan.templateKey).toBeUndefined();
  });

  it("da at recap with confirm-ready waiter → reflex_only", () => {
    const reflex = reflexFor("da", "recap");
    expect(reflex.usedT0).toBe(true);
    const plan = decideTurnPlan({
      beliefs: beliefGraph([
        belief("commerce.pressure", "confirm"),
        belief("conversation.awaiting", "confirm"),
        belief("waiter.can_confirm", true),
        belief("waiter.gap_count", 0),
      ]),
      reflex,
      message: "da",
    });
    expect(plan.kind).toBe("reflex_only");
    expect(plan.requiresLlm).toBe(false);
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

  it("complex order line with substitution → comprehend (not reflex handoff)", () => {
    const message =
      "jedno pivo, veliki beef burger sa kartoffel salatom umesto pomfrita";
    const reflex = reflexPlan({
      config,
      message,
      flowNodeId: "collect",
      hasOpenOrders: false,
    });
    expect(reflex.handoffCommand).toBeNull();
    const plan = decideTurnPlan({
      beliefs: beliefGraph([belief("conversation.mode", "ordering")]),
      reflex,
      message,
    });
    expect(plan.kind).toBe("transactional_perceive");
    expect(plan.requiresLlm).toBe(true);
  });

  it("ORDER_MODIFY without open order → status template routed through LLM", () => {
    const reflex = reflexPlan({
      config,
      message: "promeni porudžbinu",
      flowNodeId: "collect",
      hasOpenOrders: false,
    });
    expect(reflex.handoffCommand).toBeNull();
    const plan = decideTurnPlan({
      beliefs: beliefGraph([]),
      reflex,
      message: "promeni porudžbinu",
    });
    expect(plan.kind).toBe("template_tell");
    expect(plan.templateKey).toBe("status.no_order");
    expect(plan.requiresLlm).toBe(true);
  });

  it("ORDER_MODIFY with open order → reflex_only (handoff act)", () => {
    const reflex = reflexPlan({
      config,
      message: "promeni porudžbinu",
      flowNodeId: "collect",
      hasOpenOrders: true,
    });
    expect(reflex.handoffCommand?.type).toBe("ORDER.MODIFY");
    const plan = decideTurnPlan({
      beliefs: beliefGraph([belief("commerce.has_open_orders", true)]),
      reflex,
      message: "promeni porudžbinu",
    });
    expect(plan.kind).toBe("reflex_only");
    expect(plan.requiresLlm).toBe(true);
  });

  it("waiter handoff uses LLM for guest-facing copy", () => {
    const reflex = reflexPlan({
      config,
      message: "pozovi konobara",
      flowNodeId: "collect",
    });
    expect(reflex.handoffCommand?.type).toBe("WAITER.REQUEST");
    const plan = decideTurnPlan({
      beliefs: beliefGraph([]),
      reflex,
      message: "pozovi konobara",
    });
    expect(plan.kind).toBe("reflex_only");
    expect(plan.requiresLlm).toBe(true);
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
