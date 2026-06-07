import type { EvidencePointer } from "@/lib/denis/cognition/context/plan-evidence";
import type { DenisPerceiveMode } from "@/lib/denis/cognition/runtime-profile-types";
import type { DenisGoal } from "@/lib/denis/kernel/goal-types";
import type { TurnPlanKind } from "@/lib/denis/cognition/tde/turn-plan-types";

/** L3 structured perceive schema — goal-directed, not message regex. */
export type InterpretationSchema =
  | "transactional_order"
  | "relational_social"
  | "slot_reply"
  | "upsell_nudge"
  | "narrate_facts";

export type InterpretationEvidenceBudget = {
  perceiveMode: DenisPerceiveMode;
  pointers: EvidencePointer[];
  includeCatalogRag: boolean;
  includePlaybook: boolean;
  omitFullMenuWhenNoRag: boolean;
};

export type InterpretationTask = {
  schema: InterpretationSchema;
  evidenceBudget: InterpretationEvidenceBudget;
  planKind: TurnPlanKind;
  goalType: DenisGoal["type"];
  reason: string;
  /** Appended to perceive evidence — schema directive for LLM. */
  directiveBlock: string;
};
