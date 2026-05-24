import type { InPersonPaymentLocation, PaymentMethod } from "@/lib/constants";

export type PaymentMethodOption = {
  id: PaymentMethod;
  title: string;
  description: string;
};

const IN_PERSON_COPY: Record<
  InPersonPaymentLocation,
  {
    title: string;
    description: string;
    shortLabel: string;
    instruction: string;
    confirmToast: string;
  }
> = {
  bar: {
    title: "Pay at the bar",
    description: "Order now, pay at the bar when you're ready",
    shortLabel: "Bar",
    instruction: "Pay at the bar when you're ready. Your order is already with the team.",
    confirmToast: "Pay at the bar when ready",
  },
  counter: {
    title: "Pay at the counter",
    description: "Order now, pay at the counter when you're ready",
    shortLabel: "Counter",
    instruction:
      "Pay at the counter when you're ready. Your order is already with the team.",
    confirmToast: "Pay at the counter when ready",
  },
  table: {
    title: "Pay at the table",
    description: "Order now — staff will collect payment at your table",
    shortLabel: "Table",
    instruction:
      "Pay at your table when you're ready. A staff member will come to you.",
    confirmToast: "Pay at your table when ready",
  },
};

export function inPersonPaymentCopy(location: InPersonPaymentLocation) {
  return IN_PERSON_COPY[location] ?? IN_PERSON_COPY.bar;
}

export function getPaymentMethodOption(
  method: Exclude<PaymentMethod, "unset">,
  inPersonLocation: InPersonPaymentLocation = "bar"
): PaymentMethodOption {
  if (method === "at_bar") {
    const copy = inPersonPaymentCopy(inPersonLocation);
    return {
      id: "at_bar",
      title: copy.title,
      description: copy.description,
    };
  }

  if (method === "card_at_table") {
    return {
      id: "card_at_table",
      title: "Card at table",
      description: "Staff brings a card terminal to your table",
    };
  }

  if (method === "card_terminal") {
    return {
      id: "card_terminal",
      title: "Kartenzahlung (Terminal)",
      description: "Staff charges the card on a Stripe Terminal reader",
    };
  }

  if (method === "pos") {
    return {
      id: "pos",
      title: "Paid at POS",
      description: "Settled on the point-of-sale system",
    };
  }

  if (method === "pos_online") {
    return {
      id: "pos_online",
      title: "Paid online (POS order)",
      description: "Guest paid via Vera for a POS order",
    };
  }

  return {
    id: "online",
    title: "Pay online",
    description: "Apple Pay, Google Pay, or card — secure Stripe checkout",
  };
}

/** @deprecated Use getPaymentMethodOption */
export const PAYMENT_METHOD_OPTIONS: Record<
  Exclude<PaymentMethod, "unset">,
  PaymentMethodOption
> = {
  at_bar: getPaymentMethodOption("at_bar", "bar"),
  card_at_table: getPaymentMethodOption("card_at_table"),
  card_terminal: getPaymentMethodOption("card_terminal"),
  online: getPaymentMethodOption("online"),
  pos: getPaymentMethodOption("pos"),
  pos_online: getPaymentMethodOption("pos_online"),
};

export function paymentMethodLabel(
  method: PaymentMethod | string | null,
  inPersonLocation: InPersonPaymentLocation = "bar"
) {
  if (method === "at_bar") {
    return inPersonPaymentCopy(inPersonLocation).shortLabel;
  }
  if (method === "card_at_table") return "Card";
  if (method === "card_terminal") return "Terminal";
  if (method === "pos") return "POS";
  if (method === "pos_online") return "Online (POS)";
  if (method === "unset") return "Unpaid";
  return "Online";
}

export function guestPaymentInstruction(
  method: PaymentMethod | string | null,
  paymentStatus: string,
  inPersonLocation: InPersonPaymentLocation = "bar"
) {
  if (paymentStatus === "paid") return null;
  if (method === "unset") return null;
  if (method === "at_bar") {
    return inPersonPaymentCopy(inPersonLocation).instruction;
  }
  if (method === "card_at_table") {
    return "A staff member will bring a card terminal to your table.";
  }
  return null;
}

export function inPersonPaymentConfirmToast(
  inPersonLocation: InPersonPaymentLocation = "bar"
) {
  return inPersonPaymentCopy(inPersonLocation).confirmToast;
}

export function unpaidPaymentHint(
  paymentMethod: PaymentMethod | string | null,
  inPersonLocation: InPersonPaymentLocation = "bar"
) {
  if (paymentMethod === "at_bar") {
    return `Pay at the ${inPersonLocation === "counter" ? "counter" : inPersonLocation === "table" ? "table" : "bar"}`;
  }
  if (paymentMethod === "card_at_table") {
    return "Card at table";
  }
  return "Pending";
}

export type SelectablePaymentMethod = Exclude<
  PaymentMethod,
  "unset" | "pos" | "pos_online" | "card_terminal"
>;

export type StaffSelectablePaymentMethod = Exclude<
  PaymentMethod,
  "unset" | "pos" | "pos_online"
>;

export function getStaffSelectablePaymentMethods(input: {
  stripeOnboarded: boolean;
  paymentOnlineEnabled: boolean;
  paymentAtBarEnabled: boolean;
  paymentCardAtTableEnabled: boolean;
}): StaffSelectablePaymentMethod[] {
  const methods: StaffSelectablePaymentMethod[] = [];

  if (input.paymentAtBarEnabled) methods.push("at_bar");
  if (input.paymentCardAtTableEnabled) methods.push("card_at_table");
  if (input.paymentCardAtTableEnabled && input.stripeOnboarded) {
    methods.push("card_terminal");
  }
  if (
    input.stripeOnboarded &&
    input.paymentOnlineEnabled
  ) {
    methods.push("online");
  }

  return methods.length > 0 ? methods : ["at_bar"];
}

export function getAvailablePaymentMethods(input: {
  stripeOnboarded: boolean;
  stripePublishableKey: boolean;
  paymentOnlineEnabled: boolean;
  paymentAtBarEnabled: boolean;
  paymentCardAtTableEnabled: boolean;
}): SelectablePaymentMethod[] {
  const methods: SelectablePaymentMethod[] = [];

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
