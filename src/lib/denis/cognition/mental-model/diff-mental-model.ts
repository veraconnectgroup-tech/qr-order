import type {
  GuestIntentTransition,
  GuestMentalModel,
} from "@/lib/denis/cognition/mental-model/mental-model-types";
import type { GuestMentalModelSnapshot } from "@/lib/denis/cognition/mental-model/mental-model-timeline";

export type MentalModelDiffField =
  | "intent"
  | "receptiveness"
  | "frustration"
  | "nudgeBudget"
  | "predictedNeed"
  | "mealStage";

export type MentalModelDiffEntry = {
  field: MentalModelDiffField;
  from: string;
  to: string;
};

export type MentalModelDiff = {
  significant: boolean;
  changes: MentalModelDiffEntry[];
  intentTransition: GuestIntentTransition | null;
};

function pushChange(
  changes: MentalModelDiffEntry[],
  field: MentalModelDiffField,
  from: string,
  to: string
): void {
  if (from === to) return;
  changes.push({ field, from, to });
}

/** Before/after posture diff — significant shifts for timeline audit (ADR-038 Val D). */
export function diffMentalModel(input: {
  previous: GuestMentalModelSnapshot | null;
  current: GuestMentalModel;
}): MentalModelDiff {
  const previous = input.previous;
  const current = input.current;
  const changes: MentalModelDiffEntry[] = [];

  if (!previous) {
    return {
      significant: false,
      changes: [],
      intentTransition: null,
    };
  }

  pushChange(changes, "intent", previous.intent, current.intent);
  pushChange(changes, "receptiveness", previous.receptiveness, current.receptiveness);
  pushChange(changes, "predictedNeed", previous.predictedNeed, current.predictedNeed);
  pushChange(changes, "mealStage", previous.mealStage, current.mealStage);

  if (previous.frustrationLevel !== current.affect.frustration.level) {
    pushChange(
      changes,
      "frustration",
      previous.frustrationLevel,
      current.affect.frustration.level
    );
  }

  if (
    previous.nudgeBudget.remaining > 0 &&
    current.nudgeBudget.remaining === 0
  ) {
    pushChange(
      changes,
      "nudgeBudget",
      String(previous.nudgeBudget.remaining),
      "0"
    );
  }

  const latestTransition =
    current.intentTransitions[current.intentTransitions.length - 1] ?? null;
  const intentTransition =
    latestTransition?.to === current.intent &&
    latestTransition.from === previous.intent
      ? latestTransition
      : null;

  const significant =
    changes.some((change) => change.field === "intent") ||
    changes.some((change) => change.field === "receptiveness") ||
    (previous.frustrationLevel !== "high" &&
      current.affect.frustration.level === "high") ||
    changes.some((change) => change.field === "nudgeBudget");

  return {
    significant,
    changes,
    intentTransition,
  };
}
