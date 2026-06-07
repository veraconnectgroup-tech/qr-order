import { describe, expect, it } from "vitest";
import {
  belief,
  beliefGraph,
  buildInterpretationTask,
  decideTurnPlan,
} from "@/lib/denis/cognition/tde";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";
import { planTurnWithReflex } from "@/lib/denis/kernel/reflex-plan";
import { runInterpretationTaskSuite } from "@/lib/denis/eval/run-interpretation-task-fixture";
import { INTERPRETATION_TASK_SCENARIOS } from "@/lib/denis/eval/fixtures/interpretation-task/scenarios";

const config = CONCIERGE_PLATFORM_DEFAULTS;

function reflexFor(message: string, flowNodeId: "collect" | "welcome" | "browse" = "collect") {
  return planTurnWithReflex({
    config,
    message,
    flowNodeId,
    cartState: emptyCartState(),
    skipUpsell: false,
  });
}

describe("buildInterpretationTask — L3 schema", () => {
  it("maps COMPLETE_ROUND + ordering pressure to transactional schema", () => {
    const beliefs = beliefGraph([
      belief("conversation.mode", "ordering"),
      belief("commerce.pressure", "open"),
    ]);
    const task = buildInterpretationTask(
      { type: "COMPLETE_ROUND", priority: 90 },
      beliefs
    );
    expect(task?.schema).toBe("transactional_order");
    expect(task?.planKind).toBe("transactional_perceive");
    expect(task?.directiveBlock).toContain("goal-directed L3");
  });

  it("maps GUEST_SEATED to relational social schema", () => {
    const task = buildInterpretationTask(
      { type: "GUEST_SEATED", priority: 10 },
      beliefGraph([])
    );
    expect(task?.schema).toBe("relational_social");
    expect(task?.planKind).toBe("relational_perceive");
  });
});

describe("decideTurnPlan — goal-directed over regex (ARCH-7)", () => {
  it("vague recommend with open cart uses goal.complete_round.transactional", () => {
    const beliefs = beliefGraph([
      belief("conversation.mode", "ordering"),
      belief("commerce.pressure", "open"),
    ]);
    const reflex = planTurnWithReflex({
      config,
      message: "preporuči mi nešto",
      flowNodeId: "collect",
      cartState: {
        ...emptyCartState(),
        draft: {
          cartRevision: 1,
          items: [
            {
              productId: "p-pils",
              productName: "Pils",
              quantity: 1,
              serveSize: "0.5L",
              modifierIds: [],
              notes: "",
              lineTotal: 4.5,
              menuSection: "drinks",
            },
          ],
        },
      },
    });

    const plan = decideTurnPlan({
      beliefs,
      reflex,
      message: "preporuči mi nešto",
    });

    expect(plan.kind).toBe("transactional_perceive");
    expect(plan.reason).toBe("goal.complete_round.transactional");
    expect(plan.reason).not.toContain("vague_recommend");
  });

  it("UPSELL_ONCE top goal keeps relational despite food words", () => {
    const reflex = reflexFor("2x cola", "collect");
    reflex.plan = {
      ...reflex.plan,
      topGoal: { type: "UPSELL_ONCE", category: "food", priority: 40 },
    };

    const plan = decideTurnPlan({
      beliefs: beliefGraph([belief("conversation.mode", "ordering")]),
      reflex,
      message: "2x cola",
    });

    expect(plan.kind).toBe("relational_perceive");
    expect(plan.reason).toBe("goal.upsell_once.relational");
  });
});

describe("interpretation task eval fixture", () => {
  it("runs ARCH-7 goal-directed suite green", () => {
    const report = runInterpretationTaskSuite();
    if (!report.ok) {
      console.error(JSON.stringify(report.results.filter((row) => !row.passed), null, 2));
    }
    expect(report.ok).toBe(true);
    expect(report.scenarioCount).toBe(INTERPRETATION_TASK_SCENARIOS.length);
  });
});
