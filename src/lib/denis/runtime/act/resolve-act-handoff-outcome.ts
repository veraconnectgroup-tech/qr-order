import type { ActPhaseResult } from "@/lib/denis/runtime/act/act-types";
import type { SelectablePaymentMethod } from "@/lib/payment-methods";
import {
  handoffErrorNarrationKey,
  handoffNarrationMessage,
  paymentMethodNarrationKey,
  paymentMethodQuickReplyLabels,
  type HandoffNarrationKey,
} from "@/lib/denis/runtime/act/handoff-narration";

export type ActHandoffOutcome = {
  attempted: boolean;
  overrideLegacy: boolean;
  guestMessage?: string;
  quickReplies?: string[];
  openPaymentSheet?: boolean;
  handoffKind?: "waiter" | "payment";
};

function messageForHandoff(
  key: HandoffNarrationKey,
  language: string
): string {
  return handoffNarrationMessage(key, language);
}

/** Extract live handoff skill results for guest-visible narration (M28). */
export function resolveActHandoffOutcome(
  actPhase: ActPhaseResult,
  language: string
): ActHandoffOutcome {
  const waiter = actPhase.results.find(
    (row) => row.skillId === "handoff.waiter" && !row.dryRun
  );
  if (waiter) {
    if (waiter.ok) {
      return {
        attempted: true,
        overrideLegacy: true,
        guestMessage: messageForHandoff("waiter_on_way", language),
        handoffKind: "waiter",
      };
    }
    return {
      attempted: true,
      overrideLegacy: true,
      guestMessage: messageForHandoff(
        handoffErrorNarrationKey(waiter.error ?? "handoff_failed"),
        language
      ),
      handoffKind: "waiter",
    };
  }

  const payment = actPhase.results.find(
    (row) => row.skillId === "handoff.payment" && !row.dryRun
  );
  if (!payment) {
    return { attempted: false, overrideLegacy: false };
  }

  if (payment.ok && payment.detail?.needsMethod === true) {
    return {
      attempted: true,
      overrideLegacy: true,
      guestMessage: messageForHandoff("ask_payment_method", language),
      quickReplies: paymentMethodQuickReplyLabels(language),
      handoffKind: "payment",
    };
  }

  if (payment.ok) {
    const method = payment.detail?.paymentMethod as
      | SelectablePaymentMethod
      | undefined;
    const openPaymentSheet = payment.detail?.openPaymentSheet === true;
    return {
      attempted: true,
      overrideLegacy: true,
      guestMessage: messageForHandoff(
        method ? paymentMethodNarrationKey(method) : "payment_cash",
        language
      ),
      openPaymentSheet,
      handoffKind: "payment",
    };
  }

  return {
    attempted: true,
    overrideLegacy: true,
    guestMessage: messageForHandoff(
      handoffErrorNarrationKey(payment.error ?? "handoff_failed"),
      language
    ),
    handoffKind: "payment",
  };
}

export function handoffActEnabled(config: {
  handoff: {
    waiterCall: boolean;
    paymentHint: boolean;
    liveExecution?: boolean;
  };
}): boolean {
  if (config.handoff.liveExecution === false) return false;
  return config.handoff.waiterCall || config.handoff.paymentHint;
}
