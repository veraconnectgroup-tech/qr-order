/** Re-exports for eval layer — eval may not import venue directly. */
export { computeStationQueues } from "@/lib/denis/venue/floor/compute-station-queues";
export { deriveHouseUnderstaffedHint } from "@/lib/denis/venue/floor/derive-table-hint";
export { shouldAutoRushFromFloor } from "@/lib/denis/venue/floor/should-auto-rush-from-floor";
export type { VenueOpsBeliefs } from "@/lib/denis/venue/ops/types";
export { deriveOpsPlannerEffects } from "@/lib/denis/venue/ops/planner-effects";
