import type { DenisGoal } from "@/lib/denis/kernel/goal-types";
import type { TurnPlanKind } from "@/lib/denis/cognition/tde/turn-plan-types";
import type { WaiterParitySetup } from "@/lib/denis/eval/waiter-parity-types";
import { drinkLine } from "@/lib/denis/eval/fixtures/waiter-parity/helpers";

export type InterpretationTaskScenario = {
  id: string;
  description: string;
  message: string;
  setup?: WaiterParitySetup;
  /** Override reflex top goal when stack priority hides it (e.g. UPSELL_ONCE). */
  topGoalOverride?: DenisGoal;
  expect: {
    planKind: TurnPlanKind;
    reason: string;
    forbidReasons?: string[];
    schema?: string;
  };
};

/** ARCH-7 / C12 — goal-directed plan must not follow message-regex lies. */
export const INTERPRETATION_TASK_SCENARIOS: InterpretationTaskScenario[] = [
  {
    id: "arch7_vague_recommend_open_cart",
    description:
      "COMPLETE_ROUND + open cart: vague recommend stays transactional (regex would pick relational)",
    setup: {
      flowNodeId: "collect",
      aiCartItems: [drinkLine("p-pils", "Pils", "0.5L")],
    },
    message: "preporuči mi nešto",
    expect: {
      planKind: "transactional_perceive",
      reason: "goal.complete_round.transactional",
      forbidReasons: ["vague_recommend"],
      schema: "transactional_order",
    },
  },
  {
    id: "arch7_guest_seated_social",
    description: "GUEST_SEATED welcome thread stays relational social",
    setup: { flowNodeId: "welcome" },
    message: "Zdravo kako si",
    expect: {
      planKind: "relational_perceive",
      reason: "goal.guest_seated.social",
      schema: "relational_social",
    },
  },
  {
    id: "arch7_upsell_food_words",
    description:
      "UPSELL_ONCE top goal: food words stay relational upsell (not transactional regex)",
    setup: { flowNodeId: "upsell_food" },
    message: "2x cola i burger",
    topGoalOverride: { type: "UPSELL_ONCE", category: "food", priority: 40 },
    expect: {
      planKind: "relational_perceive",
      reason: "goal.upsell_once.relational",
      forbidReasons: ["comprehend_first.default", "commerce.pressure.comprehend"],
      schema: "upsell_nudge",
    },
  },
  {
    id: "arch7_collect_social_no_cart",
    description: "COMPLETE_ROUND without commerce pressure stays social at collect",
    setup: { flowNodeId: "collect" },
    message: "preporuči mi nešto",
    expect: {
      planKind: "relational_perceive",
      reason: "goal.complete_round.social",
      schema: "relational_social",
    },
  },
];
