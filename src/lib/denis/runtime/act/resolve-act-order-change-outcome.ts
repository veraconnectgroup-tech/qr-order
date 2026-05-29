import type { ActPhaseResult } from "@/lib/denis/runtime/act/act-types";
import {
  orderChangeErrorNarrationKey,
  orderChangeNarrationMessage,
} from "@/lib/denis/runtime/act/order-change-narration";

export type ActOrderChangeOutcome = {
  attempted: boolean;
  overrideLegacy: boolean;
  guestMessage?: string;
};

/** Extract live order.cancel / order.modify.request results for guest narration. */
export function resolveActOrderChangeOutcome(
  actPhase: ActPhaseResult,
  language: string
): ActOrderChangeOutcome {
  const cancel = actPhase.results.find(
    (row) => row.skillId === "order.cancel" && !row.dryRun
  );
  if (cancel) {
    if (cancel.ok) {
      const kind = cancel.detail?.kind as string | undefined;
      const orderNumber =
        typeof cancel.detail?.orderNumber === "number"
          ? cancel.detail.orderNumber
          : null;

      if (kind === "cancelled") {
        return {
          attempted: true,
          overrideLegacy: true,
          guestMessage: orderChangeNarrationMessage(
            "cancel_ok",
            language,
            orderNumber
          ),
        };
      }

      if (kind === "staff_escalation") {
        return {
          attempted: true,
          overrideLegacy: true,
          guestMessage: orderChangeNarrationMessage(
            "staff_escalation_cancel",
            language,
            orderNumber
          ),
        };
      }
    }

    return {
      attempted: true,
      overrideLegacy: true,
      guestMessage: orderChangeNarrationMessage(
        orderChangeErrorNarrationKey(cancel.error ?? "cancel_failed"),
        language
      ),
    };
  }

  const modify = actPhase.results.find(
    (row) => row.skillId === "order.modify.request" && !row.dryRun
  );
  if (!modify) {
    return { attempted: false, overrideLegacy: false };
  }

  if (modify.ok) {
    const kind = modify.detail?.kind as string | undefined;
    const orderNumber =
      typeof modify.detail?.orderNumber === "number"
        ? modify.detail.orderNumber
        : null;

    if (kind === "cancelled_reorder") {
      return {
        attempted: true,
        overrideLegacy: true,
        guestMessage: orderChangeNarrationMessage(
          "modify_cancelled_reorder",
          language,
          orderNumber
        ),
      };
    }

    return {
      attempted: true,
      overrideLegacy: true,
      guestMessage: orderChangeNarrationMessage(
        "staff_escalation_modify",
        language,
        orderNumber
      ),
    };
  }

  return {
    attempted: true,
    overrideLegacy: true,
    guestMessage: orderChangeNarrationMessage(
      orderChangeErrorNarrationKey(modify.error ?? "handoff_failed"),
      language
    ),
  };
}

export function orderChangeActEnabled(config: {
  ordering: { actLayerEnabled: boolean; actDryRun: boolean };
}): boolean {
  return config.ordering.actLayerEnabled && !config.ordering.actDryRun;
}
