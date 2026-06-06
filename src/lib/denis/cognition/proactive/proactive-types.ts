export type ProactiveTickPayload = {
  browseMinutes?: number;
  cartItemCount?: number;
  hasSessionOrders?: boolean;
  hasDrinkInCart?: boolean;
  dismissedNudgeKeys?: string[];
};

export type GuestProactiveNudge = {
  kind: "browse_nudge" | "drink_pairing" | "dessert_nudge" | "slow_kitchen";
  message: string;
  orderId?: string;
  prompt?: string;
};
