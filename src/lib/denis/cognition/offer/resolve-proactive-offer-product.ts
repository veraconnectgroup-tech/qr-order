import type { GuestProactiveNudgeKind } from "@/lib/denis/cognition/proactive/proactive-types";
import type { TableSessionState } from "@/lib/denis/loop/types";

export type ProactiveOfferProductSnapshot = {
  productId: string | null;
  productName: string | null;
  offerResolution: string | null;
  offerHash: string | null;
};

/** Resolve offer product attached to a proactive nudge emit (GMM-12). */
export function resolveProactiveOfferProduct(
  state: TableSessionState,
  kind: GuestProactiveNudgeKind
): ProactiveOfferProductSnapshot {
  const { offer } = state;
  const offerHash = offer.hash !== "empty" ? offer.hash : null;

  if (kind === "cart_recovery") {
    const target = offer.cartRecovery ?? offer.primary;
    if (!target) {
      return {
        productId: null,
        productName: null,
        offerResolution: null,
        offerHash,
      };
    }
    return {
      productId: target.productId,
      productName: target.productName,
      offerResolution: target.resolution,
      offerHash,
    };
  }

  if (kind === "browse_nudge") {
    const target = offer.primary;
    if (!target) {
      return {
        productId: null,
        productName: null,
        offerResolution: null,
        offerHash,
      };
    }
    return {
      productId: target.productId,
      productName: target.productName,
      offerResolution: target.resolution,
      offerHash,
    };
  }

  return {
    productId: null,
    productName: null,
    offerResolution: null,
    offerHash: null,
  };
}
