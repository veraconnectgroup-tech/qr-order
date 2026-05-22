import type { PaymentMethod } from "@/lib/constants";

export type PaymentMethodOption = {
  id: PaymentMethod;
  title: string;
  description: string;
};

export const PAYMENT_METHOD_OPTIONS: Record<PaymentMethod, PaymentMethodOption> =
  {
    at_bar: {
      id: "at_bar",
      title: "Bar",
      description: "Poruči odmah, plati na šanku",
    },
    card_at_table: {
      id: "card_at_table",
      title: "Kartica",
      description: "Konobar donosi terminal za karticu do stola",
    },
    online: {
      id: "online",
      title: "Online plaćanje",
      description: "Apple Pay, Google Pay ili kartica — Stripe checkout",
    },
  };

export function paymentMethodLabel(method: PaymentMethod | string | null) {
  if (method === "at_bar") return "Bar";
  if (method === "card_at_table") return "Kartica";
  return "Online";
}

export function guestPaymentInstruction(
  method: PaymentMethod | string | null,
  paymentStatus: string
) {
  if (paymentStatus === "paid") return null;
  if (method === "at_bar") {
    return "Plati na šanku kad budeš spreman. Porudžbina je već kod tima.";
  }
  if (method === "card_at_table") {
    return "Konobar će doneti terminal za karticu do tvog stola.";
  }
  return null;
}

export function getAvailablePaymentMethods(input: {
  stripeOnboarded: boolean;
  stripePublishableKey: boolean;
  paymentOnlineEnabled: boolean;
  paymentAtBarEnabled: boolean;
  paymentCardAtTableEnabled: boolean;
}): PaymentMethod[] {
  const methods: PaymentMethod[] = [];

  if (
    input.stripeOnboarded &&
    input.stripePublishableKey &&
    input.paymentOnlineEnabled
  ) {
    methods.push("online");
  }
  if (input.paymentAtBarEnabled) methods.push("at_bar");
  if (input.paymentCardAtTableEnabled) methods.push("card_at_table");

  if (methods.length === 0) {
    methods.push("at_bar");
  }

  return methods;
}
