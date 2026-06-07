import type { GuestOfferContext } from "@/lib/denis/cognition/offer/offer-types";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

export type OfferResolvedSnapshot = {
  hash: string;
  readiness: GuestOfferContext["readiness"];
  primaryProductId: string | null;
  alternativeProductId: string | null;
  strategy: string;
  sequencePattern: GuestOfferContext["sequencePattern"];
};

export type OfferResolvedPayload = {
  type: "offer.resolved";
  hash: string;
  computedAt: number;
  snapshot: OfferResolvedSnapshot;
  triggers: string[];
};

function asRecord(payload: DenisTimelineRow["payload"]): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return {};
}

export function extractLastOfferSnapshot(
  timeline: DenisTimelineRow[]
): OfferResolvedSnapshot | null {
  for (let index = timeline.length - 1; index >= 0; index -= 1) {
    const row = timeline[index]!;
    if (row.event_type !== "offer.resolved") continue;
    const payload = asRecord(row.payload);
    if (payload.type !== "offer.resolved") continue;
    const snapshot = payload.snapshot;
    if (!snapshot || typeof snapshot !== "object") continue;
    return snapshot as OfferResolvedSnapshot;
  }
  return null;
}

export function buildOfferResolvedTriggers(input: {
  offer: GuestOfferContext;
  previous: OfferResolvedSnapshot | null;
}): string[] {
  const triggers: string[] = [];
  if (!input.previous) {
    triggers.push("offer.initial");
    return triggers;
  }
  if (input.previous.hash !== input.offer.hash) {
    triggers.push("offer.hash_changed");
  }
  if (input.previous.primaryProductId !== (input.offer.primary?.productId ?? null)) {
    triggers.push("offer.primary_changed");
  }
  if (input.previous.readiness.ready !== input.offer.readiness.ready) {
    triggers.push("offer.readiness_changed");
  }
  return triggers;
}

export function shouldAppendOfferResolved(input: {
  timeline: DenisTimelineRow[];
  offer: GuestOfferContext;
}): boolean {
  const previous = extractLastOfferSnapshot(input.timeline);
  if (!previous) return input.offer.primary != null || input.offer.readiness.ready;
  return previous.hash !== input.offer.hash;
}

export function buildOfferResolvedPayload(input: {
  offer: GuestOfferContext;
  previous: OfferResolvedSnapshot | null;
}): OfferResolvedPayload {
  const snapshot: OfferResolvedSnapshot = {
    hash: input.offer.hash,
    readiness: input.offer.readiness,
    primaryProductId: input.offer.primary?.productId ?? null,
    alternativeProductId: input.offer.alternative?.productId ?? null,
    strategy: input.offer.trace.strategy,
    sequencePattern: input.offer.sequencePattern,
  };

  return {
    type: "offer.resolved",
    hash: input.offer.hash,
    computedAt: input.offer.computedAt,
    snapshot,
    triggers: buildOfferResolvedTriggers({
      offer: input.offer,
      previous: input.previous,
    }),
  };
}
