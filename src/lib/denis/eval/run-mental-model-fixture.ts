import { gateProactiveNudge } from "@/lib/denis/cognition/proactive/apply-proactive-policy";
import { foldGuestMentalModel } from "@/lib/denis/cognition/mental-model/fold-guest-mental-model";
import { foldGuestSignals } from "@/lib/denis/cognition/mental-model/fold-guest-signals";
import { assertMentalModelInvariants } from "@/lib/denis/cognition/mental-model/mental-model-invariants";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";
import { buildMergedCart } from "@/lib/denis/loop/merge-session-cart";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";
import {
  assertMentalModelExpect,
  browseRow,
  buildMentalModelFoldInput,
  guestMessageRow,
  MENTAL_MODEL_SCENARIOS,
  MENTAL_MODEL_PRODUCT_ID,
  type MentalModelScenario,
} from "@/lib/denis/eval/fixtures/mental-model/scenarios";
import { foldBrowseProfile } from "@/lib/denis/cognition/browse/fold-browse-profile";
import { PERFORMANCE_BUDGETS } from "@/lib/performance/budgets";

export type MentalModelScenarioResult = {
  id: string;
  passed: boolean;
  errors: string[];
};

export type MentalModelReport = {
  ok: boolean;
  scenarioCount: number;
  foldMsP500: number;
  results: MentalModelScenarioResult[];
};

const FOLD_SLA_MS = PERFORMANCE_BUDGETS.foldPerformance.p500MaxMs * 8;
const PERF_TIMELINE_ROWS = 500;

function runScenario(scenario: MentalModelScenario): MentalModelScenarioResult {
  const errors: string[] = [];
  const input = buildMentalModelFoldInput(scenario);
  const model = foldGuestMentalModel(input);
  const spine = foldGuestSignals({
    timeline: scenario.timeline,
    dismissedNudgeKeys: scenario.dismissedNudges ?? [],
  });
  const browse = foldBrowseProfile(scenario.timeline);

  assertMentalModelExpect(model, scenario.expect, errors);
  assertMentalModelInvariants(
    model,
    {
      phase: scenario.phase,
      billSettled: false,
      maxProductCartChurn: spine.maxProductCartChurn,
      cartAbandonedCount: browse.cartAbandoned.length,
    },
    errors
  );

  if (!model.hash || model.hash === "empty") {
    errors.push("expected non-empty mental.hash after fold");
  }
  if (model.confidence <= 0) {
    errors.push(`expected confidence > 0, got ${model.confidence}`);
  }

  return { id: scenario.id, passed: errors.length === 0, errors };
}

function benchmarkFoldPerformance(): { ms: number; errors: string[] } {
  const errors: string[] = [];
  const timeline = Array.from({ length: PERF_TIMELINE_ROWS }, (_, index) =>
    browseRow(index + 1, {
      action: "view_product",
      productId: `prod-${index}`,
      productName: `Item ${index}`,
      categoryPath: ["food"],
      menuSection: "food",
      dwellMs: 1200,
      timestamp: `2026-06-07T12:${String(Math.floor(index / 60)).padStart(2, "0")}:${String(index % 60).padStart(2, "0")}.000Z`,
    })
  );

  const input = buildMentalModelFoldInput({
    timeline,
    phase: "browsing",
    flowNodeId: "browse",
  });

  const start = performance.now();
  foldGuestMentalModel(input);
  const ms = performance.now() - start;

  if (ms >= FOLD_SLA_MS) {
    errors.push(`fold SLA: expected <${FOLD_SLA_MS}ms on ${PERF_TIMELINE_ROWS} rows, got ${ms.toFixed(2)}ms`);
  }

  return { ms, errors };
}

function runGateScenario(scenario: MentalModelScenario): MentalModelScenarioResult {
  const errors: string[] = [];
  const input = buildMentalModelFoldInput(scenario);
  const mental = foldGuestMentalModel(input);
  const gate = gateProactiveNudge({
    mental,
    candidate: { kind: "browse_nudge", message: "test" },
    config: input.config,
    now: input.now,
  });

  if (scenario.id === "gmm_closed_blocks_nudge") {
    if (gate.allow) errors.push("gate: expected browse_nudge blocked for closed guest");
    if (gate.reason !== "gmm.receptiveness_closed") {
      errors.push(`gate.reason: expected gmm.receptiveness_closed, got ${gate.reason}`);
    }
  }

  if (scenario.id === "gmm_frustrated_escalate") {
    if (gate.allow) errors.push("gate: expected browse_nudge blocked for frustrated guest");
    if (gate.reason !== "gmm.frustration_high") {
      errors.push(`gate.reason: expected gmm.frustration_high, got ${gate.reason}`);
    }
  }

  if (scenario.id === "gmm_party_leader_only") {
    if (gate.allow) errors.push("gate: expected browse_nudge blocked for party follower");
    if (gate.reason !== "gmm.group_address_follower") {
      errors.push(
        `gate.reason: expected gmm.group_address_follower, got ${gate.reason}`
      );
    }
  }

  if (scenario.id === "gmm_dessert_window") {
    const dessertGate = gateProactiveNudge({
      mental,
      candidate: { kind: "dessert_nudge", message: "test" },
      config: input.config,
      now: input.now,
    });
    if (!dessertGate.allow) {
      errors.push(
        `gate: expected dessert_nudge allowed in dessert_window, got ${dessertGate.reason}`
      );
    }
  }

  if (scenario.id === "gmm_decline_cooldown_no_third") {
    if (gate.allow) errors.push("gate: expected browse_nudge blocked after 2 declines");
    if (mental.nudgeBudget.remaining !== 0) {
      errors.push(`nudgeBudget.remaining: expected 0, got ${mental.nudgeBudget.remaining}`);
    }
  }

  if (scenario.id === "gmm_price_affinity_premium") {
    const popularityGate = gateProactiveNudge({
      mental,
      candidate: { kind: "popularity_pair", message: "test" },
      config: input.config,
      now: input.now,
    });
    if (!popularityGate.allow) {
      errors.push(
        `gate: expected popularity_pair allowed for premium affinity, got ${popularityGate.reason}`
      );
    }
  }

  if (scenario.id === "gmm_price_affinity_budget") {
    const popularityGate = gateProactiveNudge({
      mental,
      candidate: { kind: "popularity_pair", message: "test" },
      config: input.config,
      now: input.now,
    });
    if (popularityGate.allow) {
      errors.push("gate: expected popularity_pair blocked for budget affinity");
    }
    if (popularityGate.reason !== "gmm.price_affinity_mismatch" &&
        popularityGate.reason !== "gmm.pace_rushed") {
      errors.push(
        `gate.reason: expected gmm.price_affinity_mismatch or gmm.pace_rushed, got ${popularityGate.reason}`
      );
    }
  }

  return { id: `${scenario.id}_gate`, passed: errors.length === 0, errors };
}

/** ADR-038 Val B — guest posture fold + spine invariants + gate unit checks. */
export function runMentalModelFusionFixture(): MentalModelScenarioResult[] {
  const results: MentalModelScenarioResult[] = [];
  const baseNow = Date.parse("2026-06-07T12:30:00.000Z");

  {
    const errors: string[] = [];
    const input = buildMentalModelFoldInput({
      timeline: [
        guestMessageRow(1, "pivo", "2026-06-07T12:29:40.000Z"),
        guestMessageRow(2, "salat", "2026-06-07T12:29:44.000Z"),
        guestMessageRow(3, "brzo", "2026-06-07T12:29:52.000Z"),
        browseRow(4, {
          action: "view_product",
          productId: MENTAL_MODEL_PRODUCT_ID,
          productName: "Burger",
          categoryPath: ["food"],
          menuSection: "food",
          dwellMs: 1200,
          timestamp: "2026-06-07T12:29:55.000Z",
        }),
      ],
      phase: "browsing",
      flowNodeId: "browse",
    });
    input.now = baseNow;
    const model = foldGuestMentalModel(input);
    if (model.pace !== "rushed") {
      errors.push(`rushed+open: expected pace=rushed, got ${model.pace}`);
    }
    if (model.receptiveness !== "open") {
      errors.push(`rushed+open: expected receptiveness=open, got ${model.receptiveness}`);
    }
    if (model.fusion.guidance.style !== "short_direct") {
      errors.push(
        `rushed+open: expected fusion.style=short_direct, got ${model.fusion.guidance.style}`
      );
    }
    results.push({ id: "gmm_fusion_rushed_open", passed: errors.length === 0, errors });
  }

  {
    const errors: string[] = [];
    const input = buildMentalModelFoldInput({
      timeline: [
        browseRow(1, {
          action: "view_product",
          productId: "p1",
          productName: "Pasta",
          categoryPath: ["food"],
          menuSection: "food",
          dwellMs: 5000,
          timestamp: "2026-06-07T12:00:00.000Z",
        }),
      ],
      phase: "browsing",
      flowNodeId: "browse",
    });
    input.now = baseNow;
    const model = foldGuestMentalModel(input);
    const silence = model.fusion.anomalies.find((row) => row.kind === "menu_silence");
    if (!silence || silence.suggestedAction !== "gentle_nudge") {
      errors.push("menu silence: expected gentle_nudge anomaly after 15min");
    }
    results.push({ id: "gmm_fusion_menu_silence", passed: errors.length === 0, errors });
  }

  {
    const errors: string[] = [];
    const input = buildMentalModelFoldInput({
      timeline: [
        guestMessageRow(1, "1x pils molim", "2026-06-07T12:28:00.000Z"),
        guestMessageRow(2, "super izgleda", "2026-06-07T12:28:30.000Z"),
        guestMessageRow(3, "jos jedno", "2026-06-07T12:29:00.000Z"),
      ],
      phase: "ordering",
      flowNodeId: "recap",
      orders: [],
    });
    input.commerce.cart = buildMergedCart({
      ai: {
        draft: {
          cartRevision: 2,
          items: [
            {
              productId: "prod-pils",
              productName: "Pilsner",
              quantity: 2,
              serveSize: "0.5L",
              modifierIds: [],
              notes: "",
              lineTotal: 9,
              menuSection: "drinks",
            },
          ],
        },
        undoStack: [],
      },
    });
    input.now = baseNow;
    const model = foldGuestMentalModel(input);
    if (model.fusion.readiness.score < 0.8) {
      errors.push(
        `readiness: expected score >= 0.8, got ${model.fusion.readiness.score}`
      );
    }
    if (!model.fusion.readiness.offerSubmit) {
      errors.push("readiness: expected offerSubmit=true for high readiness");
    }
    results.push({ id: "gmm_fusion_high_readiness", passed: errors.length === 0, errors });
  }

  {
    const errors: string[] = [];
    const churnTimeline: DenisTimelineRow[] = [];
    let seq = 1;
    for (let i = 0; i < 3; i++) {
      churnTimeline.push(
        browseRow(seq++, {
          action: "add_to_cart",
          productId: MENTAL_MODEL_PRODUCT_ID,
          productName: `Burger ${i + 1}`,
          categoryPath: ["food"],
          menuSection: "food",
          timestamp: `2026-06-07T12:29:${String(10 + i * 2).padStart(2, "0")}.000Z`,
        }),
        browseRow(seq++, {
          action: "remove_from_cart",
          productId: MENTAL_MODEL_PRODUCT_ID,
          productName: `Burger ${i + 1}`,
          categoryPath: ["food"],
          menuSection: "food",
          timestamp: `2026-06-07T12:29:${String(11 + i * 2).padStart(2, "0")}.000Z`,
        })
      );
    }
    const input = buildMentalModelFoldInput({
      timeline: churnTimeline,
      phase: "browsing",
      flowNodeId: "browse",
    });
    input.now = baseNow;
    const model = foldGuestMentalModel(input);
    const churn = model.fusion.anomalies.find(
      (row) => row.kind === "cart_churn_indecisive"
    );
    if (!churn || churn.suggestedAction !== "offer_comparison") {
      errors.push("cart churn: expected offer_comparison anomaly after 3x add/remove");
    }
    results.push({ id: "gmm_fusion_cart_churn", passed: errors.length === 0, errors });
  }

  {
    const errors: string[] = [];
    const input = buildMentalModelFoldInput({
      timeline: [],
      phase: "ordering",
      flowNodeId: "collect",
    });
    input.commerce.cart = buildMergedCart({
      ai: {
        draft: {
          cartRevision: 1,
          items: [
            {
              productId: "prod-salad",
              productName: "Salata",
              quantity: 1,
              serveSize: null,
              modifierIds: [],
              notes: "",
              lineTotal: 8,
              menuSection: "food",
            },
          ],
        },
        undoStack: [],
      },
    });
    input.previousFold = {
      intent: "eating",
      computedAt: baseNow - 120_000,
      intentTransitions: [],
    };
    input.now = baseNow;
    const model = foldGuestMentalModel(input);
    const abnormal = model.fusion.guidance.abnormalTransition;
    if (!abnormal || abnormal.from !== "eating" || abnormal.to !== "ordering") {
      errors.push("abnormal transition: expected eating→ordering");
    }
    if (model.fusion.guidance.style !== "reorder_during_meal") {
      errors.push(
        `abnormal transition: expected reorder_during_meal style, got ${model.fusion.guidance.style}`
      );
    }
    results.push({ id: "gmm_fusion_reorder_during_meal", passed: errors.length === 0, errors });
  }

  return results;
}

export function runMentalModelSuite(): MentalModelReport {
  const results = [
    ...MENTAL_MODEL_SCENARIOS.map(runScenario),
    ...runMentalModelFusionFixture(),
    ...MENTAL_MODEL_SCENARIOS.filter((row) =>
      [
        "gmm_closed_blocks_nudge",
        "gmm_frustrated_escalate",
        "gmm_party_leader_only",
        "gmm_dessert_window",
        "gmm_decline_cooldown_no_third",
        "gmm_price_affinity_premium",
        "gmm_price_affinity_budget",
      ].includes(row.id)
    ).map(runGateScenario),
  ];
  const perf = benchmarkFoldPerformance();

  if (perf.errors.length > 0) {
    results.push({
      id: "gmm_fold_performance_p500",
      passed: false,
      errors: perf.errors,
    });
  }

  return {
    ok: results.every((row) => row.passed),
    scenarioCount: MENTAL_MODEL_SCENARIOS.length,
    foldMsP500: perf.ms,
    results,
  };
}
