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
