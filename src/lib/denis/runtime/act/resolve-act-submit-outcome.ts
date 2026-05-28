import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import type { ActPhaseResult } from "@/lib/denis/runtime/act/act-types";

/** ADR-010 F8-3 — live ACL submit (not dry-run preview). */
export function isActSubmitLive(config: ConciergeConfig): boolean {
  return (
    config.ordering.actLayerEnabled &&
    config.ordering.actSubmitEnabled &&
    !config.ordering.actDryRun
  );
}

export type ActSubmitOutcome = {
  /** Act ran order.submit outside dry-run. */
  attempted: boolean;
  orderNumber?: number;
  submitError?: string;
  guestBlockedReason?: string;
};

function guestMessageForSubmitError(error: string): string {
  switch (error) {
    case "empty_cart":
      return "Korpa je prazna — dodajte stavke pre slanja porudžbine.";
    case "missing_submit_context":
      return "Nije moguće poslati porudžbinu — osvežite stranicu i pokušajte ponovo.";
    default:
      return "Porudžbina nije mogla biti poslata. Pokušajte ponovo ili pitajte osoblje.";
  }
}

/** Extract live order.submit result from act phase (F8-3). */
export function resolveActSubmitOutcome(
  actPhase: ActPhaseResult
): ActSubmitOutcome {
  const submit = actPhase.results.find((row) => row.skillId === "order.submit");
  if (!submit || submit.dryRun) {
    return { attempted: false };
  }

  if (submit.ok) {
    const orderNumber =
      typeof submit.detail?.orderNumber === "number"
        ? submit.detail.orderNumber
        : undefined;
    return { attempted: true, orderNumber };
  }

  const submitError = submit.error ?? "submit_failed";
  return {
    attempted: true,
    submitError,
    guestBlockedReason: guestMessageForSubmitError(submitError),
  };
}
