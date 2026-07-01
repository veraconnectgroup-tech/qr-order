import type { OrderFact } from "@/lib/denis/loop/types";
import type { DenisDockUrgency } from "@/lib/denis/loop/view-types";
import type { SessionPhase } from "@/lib/scene/types";
import type { AnticipationExpect, AnticipationSetup } from "@/lib/denis/eval/anticipation-types";
import type { LocationPrepTimePriorsJson } from "@/lib/denis/config/prep-time-priors";
import type { LocationRhythmPriorsJson } from "@/lib/denis/config/rhythm-prior-types";
import type { RhythmSlotStress } from "@/lib/denis/config/rhythm-prior-types";
import type { VenueOpsBeliefs } from "@/lib/denis/loop/omniscient-eval-bridge";

export type OmniscientCategory =
  | "kitchen"
  | "bar"
  | "eta"
  | "rhythm"
  | "proactive"
  | "dock"
  | "floor";

export type OmniscientDockCheck = {
  type: "dock";
  phase: SessionPhase;
  orders?: OrderFact[];
  language?: string;
  headlineIncludes?: string[];
  headlineExcludes?: string[];
  sublineIncludes?: string[];
  urgency?: DenisDockUrgency;
  chipActions?: string[];
};

export type OmniscientProactiveCheck = {
  type: "proactive";
  setup: AnticipationSetup;
  payload?: {
    browseMinutes?: number;
    dismissedNudgeKeys?: string[];
  };
  expect: AnticipationExpect;
};

export type OmniscientStationQueuesCheck = {
  type: "station_queues";
  orders: Array<{
    status: string;
    created_at: string;
    accepted_at?: string | null;
    preparing_at?: string | null;
    order_items: Array<{ menu_section: string | null }>;
  }>;
  expect: {
    kitchenCount?: number;
    barCount?: number;
    kitchenAvgMin?: number;
    barAvgMin?: number;
  };
};

export type OmniscientPrepEstimateCheck = {
  type: "prep_estimate";
  priors: LocationPrepTimePriorsJson;
  items: Array<{ productId: string; station: "kitchen" | "bar" | "dessert" }>;
  isRush?: boolean;
  expectMinutes: number | null;
  expectConfidence: "high" | "low" | "none";
};

export type OmniscientWorldTellCheck = {
  type: "world_tell";
  status: string;
  items: Array<{ productName: string; quantity: number }>;
  locale?: "sr" | "de" | "en";
  expectPush: boolean;
  expectPersistTell: boolean;
  messageIncludes?: string[];
};

export type OmniscientSlowKitchenCheck = {
  type: "slow_kitchen";
  orders: Array<{
    id: string;
    status: string;
    created_at: string;
    estimated_prep_minutes: number | null;
    prep_estimate_confidence?: "high" | "low" | "none";
    menu_section?: "food" | "drinks" | "desserts";
    product_name?: string;
  }>;
  expectFires: boolean;
  expectDrinkOffer?: boolean;
  messageIncludes?: string[];
  messageForbidden?: string[];
};

export type OmniscientRhythmCheck = {
  type: "rhythm";
  priors: LocationRhythmPriorsJson;
  nowIso: string;
  timezone?: string;
  expectSlotStress?: RhythmSlotStress;
  expectSkipUpsell?: boolean;
};

export type OmniscientFloorCheck = {
  type: "floor";
  staffOnFloor: number | null;
  activeOrderCount: number;
  kdsBacklogMinutes?: number | null;
  expectHouseHint?: "Floor appears understaffed." | "No staff currently assigned to floor." | null;
  expectAutoRush?: boolean;
  expectStaffInEvidence?: boolean;
};

export type OmniscientCommerceLifecycleCheck = {
  type: "commerce_lifecycle";
  orders: OrderFact[];
  venueOps: VenueOpsBeliefs;
  expectAnyLate?: boolean;
  expectKitchenEta?: number | null;
  expectBarEta?: number | null;
  waitingLineIncludes?: string[];
  waitingLineExcludes?: string[];
};

export type OmniscientCommerceEvidenceCheck = {
  type: "commerce_evidence";
  orders: OrderFact[];
  includes?: string[];
  excludes?: string[];
};

export type OmniscientVenueOpsEvidenceCheck = {
  type: "venue_ops_evidence";
  venueOps: VenueOpsBeliefs;
  includes?: string[];
};

export type OmniscientCheck =
  | OmniscientDockCheck
  | OmniscientProactiveCheck
  | OmniscientStationQueuesCheck
  | OmniscientPrepEstimateCheck
  | OmniscientWorldTellCheck
  | OmniscientSlowKitchenCheck
  | OmniscientRhythmCheck
  | OmniscientFloorCheck
  | OmniscientCommerceLifecycleCheck
  | OmniscientCommerceEvidenceCheck
  | OmniscientVenueOpsEvidenceCheck;

export type OmniscientScenario = {
  id: string;
  description: string;
  category: OmniscientCategory;
  check: OmniscientCheck;
};

export type OmniscientScenarioResult = {
  id: string;
  description: string;
  category: OmniscientCategory;
  passed: boolean;
  errors: string[];
};

export type OmniscientReport = {
  ok: boolean;
  scenarioCount: number;
  passed: number;
  failed: number;
  minPassRate: number;
  passRate: number;
  results: OmniscientScenarioResult[];
};
