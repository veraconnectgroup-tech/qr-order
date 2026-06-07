import { foldGuestMentalModel } from "@/lib/denis/cognition/mental-model/fold-guest-mental-model";
import {
  buildMentalModelDiffPayload,
  buildMentalModelGatePayload,
  buildMentalModelUpdatedPayload,
  deriveMentalModelTriggers,
  extractLastMentalModelHash,
  extractPreviousMentalFoldContext,
  shouldAppendMentalModelDiff,
  shouldAppendMentalModelUpdated,
  summarizeMentalModelForTimeline,
} from "@/lib/denis/cognition/mental-model/mental-model-timeline";
import { diffMentalModel } from "@/lib/denis/cognition/mental-model/diff-mental-model";
import { gateProactiveNudge } from "@/lib/denis/cognition/mental-model/gate-proactive-nudge";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import {
  buildMentalModelFoldInput,
  guestMessageRow,
  MENTAL_MODEL_SCENARIOS,
} from "@/lib/denis/eval/fixtures/mental-model/scenarios";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

export type MentalModelTimelineScenarioResult = {
  id: string;
  passed: boolean;
  errors: string[];
};

export type MentalModelTimelineReport = {
  ok: boolean;
  scenarioCount: number;
  results: MentalModelTimelineScenarioResult[];
};

const AI = "00000000-0000-4000-8000-000000000099";

function mentalUpdatedRow(
  seq: number,
  hash: string,
  intent: string,
  computedAt = Date.parse("2026-06-07T12:00:00.000Z")
): DenisTimelineRow {
  return {
    id: `mm-${seq}`,
    ai_session_id: AI,
    seq,
    event_type: "mental_model.updated",
    payload: {
      type: "mental_model.updated",
      hash,
      computedAt,
      confidence: 0.7,
      model: {
        hash,
        intent,
        pace: "normal",
        receptiveness: "neutral",
        mealStage: "pre_order",
        predictedNeed: "none",
        frustrationLevel: "none",
        groupMode: "solo",
        addressLeader: true,
        intentTransitions: [],
        decline: { hardClosed: false, dismissedCount: 0 },
        nudgeBudget: { remaining: 3, max: 3 },
      },
      triggers: ["initial"],
    },
    trace_id: `trace-${seq}`,
    context_hash: hash,
    created_at: `2026-06-07T12:00:0${seq}.000Z`,
  };
}

function runTimelineScenario(input: {
  id: string;
  run: () => string[];
}): MentalModelTimelineScenarioResult {
  const errors = input.run();
  return { id: input.id, passed: errors.length === 0, errors };
}

/** ADR-038 Val B.5 — mental model timeline payload + gate observability. */
export function runMentalModelTimelineSuite(): MentalModelTimelineReport {
  const results: MentalModelTimelineScenarioResult[] = [];

  results.push(
    runTimelineScenario({
      id: "mmtl_hash_extract",
      run: () => {
        const errors: string[] = [];
        const timeline = [mentalUpdatedRow(1, "abc123", "arrived")];
        if (extractLastMentalModelHash(timeline) !== "abc123") {
          errors.push("expected last mental hash abc123");
        }
        return errors;
      },
    })
  );

  results.push(
    runTimelineScenario({
      id: "mmtl_should_append_on_change",
      run: () => {
        const errors: string[] = [];
        const closed = MENTAL_MODEL_SCENARIOS.find(
          (row) => row.id === "gmm_closed_blocks_nudge"
        );
        if (!closed) {
          errors.push("missing gmm_closed_blocks_nudge fixture");
          return errors;
        }

        const input = buildMentalModelFoldInput(closed);
        const mental = foldGuestMentalModel(input);
        const timeline = [mentalUpdatedRow(1, "old-hash", "exploring")];

        if (!shouldAppendMentalModelUpdated({ timeline, mental })) {
          errors.push("expected append when hash changed");
        }
        if (!shouldAppendMentalModelUpdated({ timeline: [], mental })) {
          errors.push("expected append on empty timeline");
        }
        return errors;
      },
    })
  );

  results.push(
    runTimelineScenario({
      id: "mmtl_triggers_intent_shift",
      run: () => {
        const errors: string[] = [];
        const arrived = buildMentalModelFoldInput(
          MENTAL_MODEL_SCENARIOS.find((row) => row.id === "gmm_arrived_welcome_ok")!
        );
        const exploring = buildMentalModelFoldInput(
          MENTAL_MODEL_SCENARIOS.find((row) => row.id === "gmm_exploring_browse_ok")!
        );
        const previous = summarizeMentalModelForTimeline(foldGuestMentalModel(arrived));
        const current = foldGuestMentalModel(exploring);
        const triggers = deriveMentalModelTriggers(previous, current);
        if (!triggers.some((trigger) => trigger.startsWith("intent:"))) {
          errors.push(`expected intent trigger, got ${triggers.join(",")}`);
        }
        const payload = buildMentalModelUpdatedPayload({ mental: current, previous });
        if (payload.type !== "mental_model.updated" || payload.triggers.length === 0) {
          errors.push("expected mental_model.updated payload with triggers");
        }
        return errors;
      },
    })
  );

  results.push(
    runTimelineScenario({
      id: "mmtl_gate_payload_closed",
      run: () => {
        const errors: string[] = [];
        const closed = MENTAL_MODEL_SCENARIOS.find(
          (row) => row.id === "gmm_closed_blocks_nudge"
        );
        if (!closed) {
          errors.push("missing gmm_closed_blocks_nudge fixture");
          return errors;
        }

        const mental = foldGuestMentalModel(buildMentalModelFoldInput(closed));
        const gate = gateProactiveNudge({
          mental,
          candidate: { kind: "browse_nudge", message: "test" },
          config: {
            ...CONCIERGE_PLATFORM_DEFAULTS,
            mentalModel: {
              ...CONCIERGE_PLATFORM_DEFAULTS.mentalModel,
              mode: "enforce",
            },
          },
        });
        const payload = buildMentalModelGatePayload({
          mental,
          mode: "enforce",
          candidateKind: "browse_nudge",
          allow: gate.allow,
          enforced: !gate.allow,
          reason: gate.reason,
          wouldBlock: gate.wouldBlock,
        });

        if (payload.type !== "mental_model.gate") {
          errors.push("expected mental_model.gate payload");
        }
        if (payload.allow !== false || payload.reason !== "gmm.receptiveness_closed") {
          errors.push("expected closed gate payload");
        }
        return errors;
      },
    })
  );

  results.push(
    runTimelineScenario({
      id: "mmtl_decline_trigger",
      run: () => {
        const errors: string[] = [];
        const timeline = [guestMessageRow(1, "ne hvala", "2026-06-07T12:00:01.000Z")];
        const closed = {
          ...MENTAL_MODEL_SCENARIOS.find((row) => row.id === "gmm_closed_blocks_nudge")!,
          timeline,
        };
        const mental = foldGuestMentalModel(buildMentalModelFoldInput(closed));
        const triggers = deriveMentalModelTriggers(null, mental);
        if (!triggers.includes("decline:hardClosed")) {
          errors.push(`expected decline:hardClosed trigger, got ${triggers.join(",")}`);
        }
        return errors;
      },
    })
  );

  results.push(
    runTimelineScenario({
      id: "mmtl_diff_intent_shift",
      run: () => {
        const errors: string[] = [];
        const arrivedInput = buildMentalModelFoldInput(
          MENTAL_MODEL_SCENARIOS.find((row) => row.id === "gmm_arrived_welcome_ok")!
        );
        const exploringInput = buildMentalModelFoldInput(
          MENTAL_MODEL_SCENARIOS.find((row) => row.id === "gmm_exploring_browse_ok")!
        );

        const arrived = foldGuestMentalModel(arrivedInput);
        const timeline = [
          mentalUpdatedRow(1, arrived.hash, arrived.intent, arrived.computedAt),
        ];
        const exploring = foldGuestMentalModel({
          ...exploringInput,
          previousFold: extractPreviousMentalFoldContext(timeline),
        });

        if (exploring.intentTransitions.length !== 1) {
          errors.push(
            `expected 1 intent transition, got ${exploring.intentTransitions.length}`
          );
        }
        const transition = exploring.intentTransitions[0];
        if (transition?.from !== "arrived" || transition.to !== "exploring") {
          errors.push(
            `expected arrived→exploring transition, got ${transition?.from}→${transition?.to}`
          );
        }

        const previous = summarizeMentalModelForTimeline(arrived);
        const diff = diffMentalModel({ previous, current: exploring });
        if (!diff.significant) {
          errors.push("expected significant diff on intent shift");
        }
        if (!diff.changes.some((change) => change.field === "intent")) {
          errors.push("expected intent field in diff changes");
        }

        const diffPayload = buildMentalModelDiffPayload({
          mental: exploring,
          previous,
        });
        if (diffPayload.type !== "mental_model.diff" || !diffPayload.significant) {
          errors.push("expected mental_model.diff payload with significant=true");
        }
        if (!shouldAppendMentalModelDiff({ previous, mental: exploring })) {
          errors.push("expected shouldAppendMentalModelDiff=true on intent shift");
        }

        return errors;
      },
    })
  );

  return {
    ok: results.every((row) => row.passed),
    scenarioCount: results.length,
    results,
  };
}
