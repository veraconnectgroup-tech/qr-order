export type UpsellCategory = "food" | "dessert" | "pairing";

export type PendingSlot = {
  kind: "serve_size" | "modifier" | "product" | "payment_method";
  productId?: string;
};

export type DenisGoal =
  | { type: "GUEST_SEATED"; priority: 10 }
  | { type: "COMPLETE_ROUND"; priority: 90 }
  | { type: "CLARIFY_SLOT"; slot: PendingSlot; priority: 80 }
  | { type: "UPSELL_ONCE"; category: UpsellCategory; priority: 40 }
  | { type: "INFORM_STATUS"; orderId: string; priority: 50 }
  | { type: "RECONCILE_CART"; priority: 95 }
  | { type: "HANDOFF"; kind: "waiter" | "payment"; priority: 96 }
  | { type: "CLOSE_VISIT"; priority: 20 };

export type GoalStack = DenisGoal[];

export type GoalDerivationContext = {
  flowNodeId: string;
  pendingSlot: PendingSlot | null;
  cartConflict: boolean;
  foodUpsellAsked: boolean;
  hasOpenOrders: boolean;
  lastIntent: string | null;
  handoffPaymentMethod?: string | null;
  skipUpsell?: boolean;
};
