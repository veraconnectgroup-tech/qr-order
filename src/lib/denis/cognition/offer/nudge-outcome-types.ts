import type { OfferResolutionKind } from "@/lib/denis/cognition/offer/offer-types";

/** Guest accepted nudge — add_to_cart within accept window (ADR-039). */
export const NUDGE_ACCEPT_WINDOW_SEC = 180;

/** Decline / ignore / expire resolution window (ADR-039). */
export const NUDGE_RESOLVE_WINDOW_SEC = 300;

export type NudgeOutcomeKind = "accepted" | "declined" | "ignored" | "expired";

export type NudgeResolutionSignal =
  | "add_to_cart"
  | "explicit_decline"
  | "dismiss"
  | "guest_message_unrelated"
  | "timeout";

export type PendingNudge = {
  nudgeId: string;
  nudgeKind: string;
  productId: string | null;
  productName: string | null;
  offerResolution: OfferResolutionKind | null;
  emittedAt: string;
  emittedMs: number;
};

export type NudgeOutcomeRecord = {
  nudgeId: string;
  nudgeKind: string;
  outcome: NudgeOutcomeKind;
  signal: NudgeResolutionSignal;
  productId: string | null;
  productName: string | null;
  offerResolution: OfferResolutionKind | null;
  emittedAt: string;
  resolvedAt: string;
  lagMs: number | null;
};

export function nudgeOutcomeDedupeKey(outcome: Pick<NudgeOutcomeRecord, "nudgeId">): string {
  return outcome.nudgeId;
}

export function buildNudgeId(input: {
  kind: string;
  productId: string | null;
  emittedAt: string;
  dedupeKey?: string | null;
}): string {
  const explicit = input.dedupeKey?.trim();
  if (explicit) return explicit;
  const product = input.productId?.trim() || "none";
  return `${input.kind}:${product}:${input.emittedAt}`;
}
