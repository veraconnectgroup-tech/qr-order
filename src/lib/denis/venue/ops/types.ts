export type VenueOperatingMode = "normal" | "rush" | "kitchen_closed" | "event";

export type KdsStressLevel = "normal" | "high";

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
  staffHint: StaffTableHint | null;
};

export type OpsPlannerEffects = {
  skipUpsell: boolean;
  shortenReplies: boolean;
  empathyNote: string | null;
  guestSafeStaffHint: string | null;
};
