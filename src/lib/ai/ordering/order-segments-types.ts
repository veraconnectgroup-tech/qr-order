import { z } from "zod";

/**
 * 2026-07-13 — replaces order-message-backfill.ts's regex segment-splitter
 * (ORDER_PREFIX/SUFFIX, MULTI_ITEM_SPLIT, splitGroupOrderSegments's persona/
 * conjunction patterns, isGenericBeerSegment/TYPED_DRINK_PATTERN). Same
 * founder directive as order-size-intent-types.ts: Denis serves guests
 * "from around the world" — a hand-rolled split-on-"i/and/und" pattern can
 * only ever cover phrasings a developer anticipated. This is genuinely the
 * LAST chance to recover a guest's order when the main turn's own
 * proposedItems came back empty despite an order-shaped message — asking a
 * SECOND, narrowly-scoped LLM call to just extract segments (not narrate,
 * decide, AND extract at once) is a real second attempt, not a repeat of
 * the same failure mode. Never decides a consequence itself —
 * resolve-order-segments (order-message-backfill.ts) re-grounds every
 * productNameGuess/categoryGuess against the real catalog before it's
 * trusted, same confidence-gate discipline as resolve-order-size-hint.ts.
 */
export const OrderSegmentSchema = z.object({
  /** Exact substring that produced this segment — audit trail. */
  quotedSpan: z.string().max(200),
  quantity: z.number().int().min(1).max(20).default(1),
  /** Who it's for, in the guest's own words ("za mene", "for my wife") — null if unstated. */
  personaHint: z.string().max(60).nullable(),
  /** Specific item name, however the guest wrote it — null if only a category was named. */
  productNameGuess: z.string().max(100).nullable(),
  /** True when the guest named a category generically (e.g. "a beer") without one specific product. */
  isGenericCategory: z.boolean(),
  /** Short English category label (beer, wine, coffee, tea, juice, soda, water, cocktail...) — null if not generic. */
  categoryGuess: z.string().max(50).nullable(),
  /** Modifier/substitution/preference phrase attached to THIS item, in the guest's words — null if none. */
  modifierText: z.string().max(200).nullable(),
});

export type OrderSegment = z.infer<typeof OrderSegmentSchema>;

export const OrderSegmentsAssessmentSchema = z.object({
  /** True only if the guest is naming item(s) to order — not asking, confirming, or chit-chat. */
  isOrderPlacement: z.boolean(),
  segments: z.array(OrderSegmentSchema).max(12),
  confidence: z.number().min(0).max(1),
});

export type OrderSegmentsAssessment = z.infer<
  typeof OrderSegmentsAssessmentSchema
>;
