import {
  resolvePaymentSuggestion,
  resolveSplitBillSuggestion,
  resolvePaymentDeclinedRecovery,
  SPLIT_BILL_CHIP_IDS,
} from "@/lib/denis/commerce/payment-intelligence";
import { resolveGuestTerminalPrompt } from "@/lib/stripe/terminal-guest-copy";
import type { SelectablePaymentMethod } from "@/lib/payment-methods";
import type { ComposeSceneInput, SessionPhase } from "./types";

export const PAYMENT_SCENE_BANNER_IDS = {
  suggestion: "payment-suggestion",
  terminal: "payment-terminal-ready",
  splitOffer: "payment-split-offer",
  declined: "payment-declined",
} as const;

export type PaymentIntelligenceContext = {
  phase: SessionPhase;
  language?: string;
  amountDue: number;
  availableMethods: SelectablePaymentMethod[];
  terminalEligible?: boolean;
  partySize?: number;
  paymentDeclined?: boolean;
  paymentAtBarEnabled?: boolean;
};

/** Merge Denis payment intelligence into scene compose input (Prompt 47). */
export function mergePaymentIntelligenceLayers(
  input: ComposeSceneInput,
  ctx: PaymentIntelligenceContext
): ComposeSceneInput {
  if (ctx.amountDue <= 0 && !ctx.paymentDeclined) {
    return input;
  }

  const banners = [...input.banners];
  const existingIds = new Set(banners.map((banner) => banner.id));
  let chips = [...input.chips];

  if (ctx.paymentDeclined) {
    const recovery = resolvePaymentDeclinedRecovery({
      language: ctx.language,
      paymentAtBarEnabled: ctx.paymentAtBarEnabled,
      availableMethods: ctx.availableMethods,
    });
    if (!existingIds.has(PAYMENT_SCENE_BANNER_IDS.declined)) {
      banners.unshift({
        id: PAYMENT_SCENE_BANNER_IDS.declined,
        message: recovery.message,
        action: "view_bill",
      });
    }
  }

  if (
    (ctx.phase === "settling" || ctx.phase === "eating") &&
    ctx.amountDue > 0
  ) {
    const suggestion = resolvePaymentSuggestion({
      amountDue: ctx.amountDue,
      language: ctx.language,
      availableMethods: ctx.availableMethods,
    });

    if (suggestion && !existingIds.has(PAYMENT_SCENE_BANNER_IDS.suggestion)) {
      banners.push({
        id: PAYMENT_SCENE_BANNER_IDS.suggestion,
        message: suggestion.message,
        action: "view_bill",
      });
    }

    if (ctx.terminalEligible && !existingIds.has(PAYMENT_SCENE_BANNER_IDS.terminal)) {
      banners.push({
        id: PAYMENT_SCENE_BANNER_IDS.terminal,
        message: resolveGuestTerminalPrompt(ctx.language),
        action: "view_bill",
      });
    }

    const split = resolveSplitBillSuggestion({
      language: ctx.language,
      partySize: ctx.partySize,
    });

    if (
      (ctx.partySize ?? 0) >= 2 &&
      !existingIds.has(PAYMENT_SCENE_BANNER_IDS.splitOffer)
    ) {
      banners.push({
        id: PAYMENT_SCENE_BANNER_IDS.splitOffer,
        message: split.prompt,
        action: "view_bill",
      });
    }

    if ((ctx.partySize ?? 0) >= 2 && chips.length === 0) {
      chips = split.chips.map((chip) => ({
        id: chip.id,
        label: chip.label,
      }));
    }
  }

  return { ...input, banners, chips };
}

export { SPLIT_BILL_CHIP_IDS };
