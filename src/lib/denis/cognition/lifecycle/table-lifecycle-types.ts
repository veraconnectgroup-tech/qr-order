import type { GuestScrollPosture } from "@/lib/denis/cognition/mental-model/mental-model-types";
import type { TableTempoPhase } from "@/lib/denis/cognition/tempo/detect-table-tempo-phase";
import type { GuestProactiveNudgeKind } from "@/lib/denis/cognition/proactive/proactive-types";

/** Unified proactive lane — tempo + browse + sommelier + IJS. */
export type TableLifecycleLane =
  | "help"
  | "explore"
  | "upsell"
  | "service"
  | "silence";

/** High-level table session stage (QR → bill). */
export type TableLifecycleStage =
  | "arrival"
  | "browsing"
  | "ordering"
  | "waiting_kitchen"
  | "eating"
  | "dessert"
  | "post_meal"
  | "paying";

export type TableLifecycleOrchestration = {
  stage: TableLifecycleStage;
  lane: TableLifecycleLane;
  tempoPhase: TableTempoPhase;
  scrollPosture: GuestScrollPosture;
  sommelierEligible: boolean;
  evidence: string[];
  preferredKinds: GuestProactiveNudgeKind[];
  suppressedKinds: GuestProactiveNudgeKind[];
};
