import { resolveProactiveOfferProduct } from "@/lib/denis/cognition/offer/resolve-proactive-offer-product";
import type { GuestProactiveNudge } from "@/lib/denis/cognition/proactive/proactive-types";
import type { TableSessionState } from "@/lib/denis/loop/types";

export type ProactiveEmittedPayload = {
  type: "proactive.emitted";
  kind: GuestProactiveNudge["kind"];
  message: string;
  orderId: string | null;
  tier: string;
  turnPlanKind?: string | null;
  turnPlanReason?: string | null;
  dedupeKey?: string;
  source?: string;
  scheduleId?: string;
  productId?: string | null;
  productName?: string | null;
  offerResolution?: string | null;
  offerHash?: string | null;
};

export function buildProactiveEmittedPayload(input: {
  state: TableSessionState;
  nudge: GuestProactiveNudge;
  message: string;
  tier?: string;
  turnPlanKind?: string | null;
  turnPlanReason?: string | null;
  dedupeKey?: string;
  source?: string;
  scheduleId?: string;
}): ProactiveEmittedPayload {
  const offerProduct = resolveProactiveOfferProduct(input.state, input.nudge.kind);

  return {
    type: "proactive.emitted",
    kind: input.nudge.kind,
    message: input.message,
    orderId: input.nudge.orderId ?? null,
    tier: input.tier ?? "template",
    turnPlanKind: input.turnPlanKind ?? null,
    turnPlanReason: input.turnPlanReason ?? null,
    dedupeKey: input.dedupeKey,
    source: input.source,
    scheduleId: input.scheduleId,
    productId: offerProduct.productId,
    productName: offerProduct.productName,
    offerResolution: offerProduct.offerResolution,
    offerHash: offerProduct.offerHash,
  };
}
