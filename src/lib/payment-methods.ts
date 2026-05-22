import type { PaymentMethod } from "@/lib/constants";

export type PaymentMethodOption = {
  id: PaymentMethod;
  title: string;
  description: string;
};

export const PAYMENT_METHOD_OPTIONS: Record<
  Exclude<PaymentMethod, "unset">,
  PaymentMethodOption
> = {
    at_bar: {
      id: "at_bar",
      title: "Bar",
      description: "Order now, pay at the bar when ready",
    },
    card_at_table: {
      id: "card_at_table",
      title: "Card",
      description: "Staff brings a card terminal to your table",
    },
    online: {
      id: "online",
      title: "Pay online",
      description: "Apple Pay, Google Pay, or card — secure Stripe checkout",
    },
  };

export function paymentMethodLabel(method: PaymentMethod | string | null) {
  if (method === "at_bar") return "Bar";
  if (method === "card_at_table") return "Card";
  if (method === "unset") return "Unpaid";
  return "Online";
}

export function guestPaymentInstruction(
  method: PaymentMethod | string | null,
  paymentStatus: string
) {
  if (paymentStatus === "paid") return null;
  if (method === "unset") return null;
  if (method === "at_bar") {
    return "Pay at the bar when you're ready. Your order is already with the team.";
  }
  if (method === "card_at_table") {
    return "A staff member will bring a card terminal to your table.";
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
