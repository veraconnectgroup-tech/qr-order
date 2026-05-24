import type { PaymentMethod } from "@/lib/constants";

export function isPaymentMethodAllowed(
  method: PaymentMethod,
  location: {
    payment_online_enabled: boolean;
    payment_at_bar_enabled: boolean;
    payment_card_at_table_enabled: boolean;
  },
  org: { stripe_onboarded: boolean }
) {
  if (method === "unset") return true;
  if (method === "online") {
    return org.stripe_onboarded && location.payment_online_enabled;
  }
  if (method === "at_bar") return location.payment_at_bar_enabled;
  if (method === "card_terminal") {
    return org.stripe_onboarded && location.payment_card_at_table_enabled;
  }
  return location.payment_card_at_table_enabled;
}
