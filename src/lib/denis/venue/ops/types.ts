import type {
  CapacityBanner,
  CapacityLevel,
} from "@/lib/denis/venue/ops/capacity-banner";
import type { EventPhase } from "@/lib/denis/venue/ops/event-mode";
import type { KitchenLoadSnapshot } from "@/lib/denis/venue/ops/kitchen-load-model";

export type VenueOperatingMode = "normal" | "rush" | "kitchen_closed" | "event";

export type KdsStressLevel = "normal" | "high";

export type StationStressLevel = "normal" | "high" | "busy" | "overloaded";

export type StationStress = {
  station: string;
  stress: StationStressLevel;
  activeCount: number;
  avgWaitMinutes: number | null;
};

export type StaffHintVisibility = "denis_only" | "guest_safe";

export type StaffTableHint = {
  text: string;
  visibility: StaffHintVisibility;
  expiresAt: string;
};

export type VenueOpsBeliefs = {
  operatingMode: VenueOperatingMode;
  kdsStress: KdsStressLevel;
  acceptingOrders: boolean;
  unavailableProductIds: string[];
  unavailableProductNames?: string[];
  staffHint: StaffTableHint | null;
  stationStress?: StationStress[];
  /** Kitchen Mind Link — live per-station queue snapshot. */
  kitchenLoad?: KitchenLoadSnapshot | null;
  staffOnFloor?: number | null;
  eventConfig?: unknown;
  houseHint?: string | null;
};

export type OpsPlannerEffects = {
  skipUpsell: boolean;
  shortenReplies: boolean;
  empathyNote: string | null;
  guestSafeStaffHint: string | null;
  capacityLevel?: CapacityLevel | null;
  capacityBanner?: CapacityBanner | null;
  preferQuickPrep?: boolean;
  suppressComplexDishes?: boolean;
  presetMenuOnly?: boolean;
  presetProductIds?: string[];
  suppressProactiveNudges?: boolean;
  drinkPromptOnly?: boolean;
  groupBillEnabled?: boolean;
  batchOrderEnabled?: boolean;
  eventPhase?: EventPhase | null;
};
