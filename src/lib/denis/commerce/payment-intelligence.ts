import {
  PAYMENT_LARGE_ORDER_THRESHOLD_EUR,
  PLATFORM_FEE_SMALL_ORDER_THRESHOLD_EUR,
} from "@/lib/constants";
import type { SelectablePaymentMethod } from "@/lib/payment-methods";
import { splitAmountEqually } from "@/lib/orders/split-payments";

export {
  PAYMENT_LARGE_ORDER_THRESHOLD_EUR,
  PLATFORM_FEE_SMALL_ORDER_THRESHOLD_EUR as PAYMENT_SMALL_ORDER_THRESHOLD_EUR,
};

export type GuestPaymentSurfaceLabel =
  | "card"
  | "apple_pay"
  | "google_pay"
  | "cash";

export type PaymentSuggestionTier = "small" | "medium" | "large";

export type PaymentSuggestion = {
  tier: PaymentSuggestionTier;
  message: string;
  recommendedMethod: SelectablePaymentMethod;
  surfaceLabels: GuestPaymentSurfaceLabel[];
};

export type SplitBillMode = "equal" | "by_items" | "per_device" | "custom";

export const SPLIT_BILL_CHIP_IDS = {
  perPerson: "split-per-person",
  byItems: "split-by-items",
  equal: "split-equal",
  perDevice: "split-per-device",
} as const;

export type SplitBillSuggestion = {
  prompt: string;
  chips: Array<{ id: string; label: string; mode: SplitBillMode }>;
};

export type PaymentDeclinedRecovery = {
  message: string;
  suggestRetry: boolean;
  alternateMethod: SelectablePaymentMethod | null;
};

export type ReceiptOptionKind = "email" | "qr" | "fiscal";

export type ReceiptOptions = {
  prompt: string;
  options: Array<{ kind: ReceiptOptionKind; label: string }>;
};

function resolveLang(language?: string): "sr" | "de" | "en" {
  const lang = (language ?? "sr").toLowerCase().slice(0, 2);
  if (lang === "de") return "de";
  if (lang === "en") return "en";
  return "sr";
}

function paymentTier(amountDue: number): PaymentSuggestionTier {
  if (amountDue < PLATFORM_FEE_SMALL_ORDER_THRESHOLD_EUR) return "small";
  if (amountDue >= PAYMENT_LARGE_ORDER_THRESHOLD_EUR) return "large";
  return "medium";
}

/** Denis payment hint by bill size — deterministic (Prompt 47). */
export function resolvePaymentSuggestion(input: {
  amountDue: number;
  language?: string;
  availableMethods: SelectablePaymentMethod[];
}): PaymentSuggestion | null {
  if (input.amountDue <= 0) return null;

  const lang = resolveLang(input.language);
  const tier = paymentTier(input.amountDue);
  const hasOnline = input.availableMethods.includes("online");
  const hasCash = input.availableMethods.includes("at_bar");
  const hasCardAtTable = input.availableMethods.includes("card_at_table");

  const surfaceLabels: GuestPaymentSurfaceLabel[] = [];
  if (hasOnline || hasCardAtTable) {
    surfaceLabels.push("card", "apple_pay", "google_pay");
  }
  if (hasCash) surfaceLabels.push("cash");

  let message: string;
  let recommendedMethod: SelectablePaymentMethod = input.availableMethods[0] ?? "online";

  if (tier === "small") {
    if (lang === "de") {
      message = "Sie können mit Karte oder bar bezahlen.";
    } else if (lang === "en") {
      message = "You can pay by card or cash.";
    } else {
      message = "Možete platiti karticom ili gotovinom.";
    }
    recommendedMethod = hasOnline ? "online" : hasCash ? "at_bar" : recommendedMethod;
  } else if (tier === "large") {
    if (lang === "de") {
      message = "Wir empfehlen Kartenzahlung für mehr Sicherheit.";
    } else if (lang === "en") {
      message = "We recommend paying by card for security.";
    } else {
      message = "Preporučujemo karticom za sigurnost.";
    }
    recommendedMethod = hasOnline
      ? "online"
      : hasCardAtTable
        ? "card_at_table"
        : recommendedMethod;
  } else {
    if (lang === "de") {
      message = "Karte, Apple Pay, Google Pay oder bar — wie es Ihnen passt.";
    } else if (lang === "en") {
      message = "Card, Apple Pay, Google Pay, or cash — whatever works for you.";
    } else {
      message = "Kartica, Apple Pay, Google Pay ili gotovina — kako vama odgovara.";
    }
    recommendedMethod = hasOnline ? "online" : recommendedMethod;
  }

  return {
    tier,
    message,
    recommendedMethod,
    surfaceLabels,
  };
}

export function resolveGuestPaymentSurfaceLabels(input: {
  availableMethods: SelectablePaymentMethod[];
  language?: string;
}): string {
  const lang = resolveLang(input.language);
  const labels: string[] = [];

  if (
    input.availableMethods.includes("online") ||
    input.availableMethods.includes("card_at_table")
  ) {
    if (lang === "de") {
      labels.push("Karte", "Apple Pay", "Google Pay");
    } else if (lang === "en") {
      labels.push("Card", "Apple Pay", "Google Pay");
    } else {
      labels.push("Kartica", "Apple Pay", "Google Pay");
    }
  }
  if (input.availableMethods.includes("at_bar")) {
    labels.push(lang === "de" ? "Bar" : lang === "en" ? "Cash" : "Gotovina");
  }

  return labels.join(" | ");
}

export function resolveDefaultPaymentMethod(input: {
  amountDue: number;
  availableMethods: SelectablePaymentMethod[];
}): SelectablePaymentMethod {
  const suggestion = resolvePaymentSuggestion({
    amountDue: input.amountDue,
    availableMethods: input.availableMethods,
  });
  if (
    suggestion &&
    input.availableMethods.includes(suggestion.recommendedMethod)
  ) {
    return suggestion.recommendedMethod;
  }
  return input.availableMethods[0] ?? "online";
}

/** Split bill Denis prompt + mode chips (Prompt 47). */
export function resolveSplitBillSuggestion(input: {
  language?: string;
  partySize?: number;
}): SplitBillSuggestion {
  const lang = resolveLang(input.language);

  if (lang === "de") {
    return {
      prompt: "Möchten Sie die Rechnung teilen?",
      chips: [
        { id: SPLIT_BILL_CHIP_IDS.perPerson, label: "Pro Person", mode: "equal" },
        { id: SPLIT_BILL_CHIP_IDS.byItems, label: "Nach Artikeln", mode: "by_items" },
        { id: SPLIT_BILL_CHIP_IDS.equal, label: "Gleichmäßig", mode: "equal" },
        { id: SPLIT_BILL_CHIP_IDS.perDevice, label: "Jeder zahlt sein", mode: "per_device" },
      ],
    };
  }

  if (lang === "en") {
    return {
      prompt: "Would you like to split the bill?",
      chips: [
        { id: SPLIT_BILL_CHIP_IDS.perPerson, label: "Per person", mode: "equal" },
        { id: SPLIT_BILL_CHIP_IDS.byItems, label: "By items", mode: "by_items" },
        { id: SPLIT_BILL_CHIP_IDS.equal, label: "Equally", mode: "equal" },
        { id: SPLIT_BILL_CHIP_IDS.perDevice, label: "Each pays own", mode: "per_device" },
      ],
    };
  }

  return {
    prompt: "Hoćete podeliti račun?",
    chips: [
      { id: SPLIT_BILL_CHIP_IDS.perPerson, label: "Po osobi", mode: "equal" },
      { id: SPLIT_BILL_CHIP_IDS.byItems, label: "Po stavkama", mode: "by_items" },
      { id: SPLIT_BILL_CHIP_IDS.equal, label: "Jednako", mode: "equal" },
      { id: SPLIT_BILL_CHIP_IDS.perDevice, label: "Svako svoje", mode: "per_device" },
    ],
  };
}

export function buildSplitEqualPreview(
  total: number,
  parts: number
): { amounts: number[]; perPerson: number } {
  const amounts = splitAmountEqually(total, parts);
  return {
    amounts,
    perPerson: amounts[0] ?? 0,
  };
}

/** Card declined → Denis recovery copy (Prompt 47). */
export function resolvePaymentDeclinedRecovery(input: {
  language?: string;
  paymentAtBarEnabled?: boolean;
  availableMethods?: SelectablePaymentMethod[];
}): PaymentDeclinedRecovery {
  const lang = resolveLang(input.language);
  const hasCash = input.availableMethods?.includes("at_bar") ?? false;
  const alternateMethod =
    input.paymentAtBarEnabled && hasCash ? ("at_bar" as const) : null;

  if (lang === "de") {
    return {
      message:
        "Entschuldigung, die Karte wurde abgelehnt. Andere Karte versuchen?",
      suggestRetry: true,
      alternateMethod,
    };
  }
  if (lang === "en") {
    return {
      message: "Sorry, the card didn't go through. Try another one?",
      suggestRetry: true,
      alternateMethod,
    };
  }
  return {
    message: "Izvinite, kartica nije prošla. Probajte drugu?",
    suggestRetry: true,
    alternateMethod,
  };
}

export function isStripeDeclinedError(error: {
  type?: string;
  code?: string;
  decline_code?: string;
}): boolean {
  return (
    error.type === "card_error" ||
    error.code === "card_declined" ||
    Boolean(error.decline_code)
  );
}

/** Receipt options after successful payment (Prompt 47). */
export function resolveReceiptOptions(input: {
  language?: string;
  fiscalEnabled?: boolean;
}): ReceiptOptions {
  const lang = resolveLang(input.language);

  if (lang === "de") {
    return {
      prompt: "Wie möchten Sie den Beleg erhalten?",
      options: [
        { kind: "email", label: "E-Mail-Beleg" },
        { kind: "qr", label: "QR-Beleg scannen" },
        ...(input.fiscalEnabled
          ? [{ kind: "fiscal" as const, label: "Fiskaler Beleg (TSE)" }]
          : []),
      ],
    };
  }
  if (lang === "en") {
    return {
      prompt: "How would you like your receipt?",
      options: [
        { kind: "email", label: "Email receipt" },
        { kind: "qr", label: "Scan QR receipt" },
        ...(input.fiscalEnabled
          ? [{ kind: "fiscal" as const, label: "Fiscal receipt (TSE)" }]
          : []),
      ],
    };
  }
  return {
    prompt: "Kako želite račun?",
    options: [
      { kind: "email", label: "Email račun" },
      { kind: "qr", label: "QR račun" },
      ...(input.fiscalEnabled
        ? [{ kind: "fiscal" as const, label: "Fiskalni Beleg (TSE)" }]
        : []),
    ],
  };
}

export function splitModeFromChipId(chipId: string): SplitBillMode | null {
  switch (chipId) {
    case SPLIT_BILL_CHIP_IDS.perPerson:
    case SPLIT_BILL_CHIP_IDS.equal:
      return "equal";
    case SPLIT_BILL_CHIP_IDS.byItems:
      return "by_items";
    case SPLIT_BILL_CHIP_IDS.perDevice:
      return "per_device";
    default:
      return null;
  }
}
