import { z } from "zod";

/**
 * 2026-07-12 — replaces a regex/keyword-list approach to detecting size
 * preference and product-category orders (BEER_CATEGORY_PATTERN,
 * NAMED_BEER_PATTERN, messageImpliesServeSize's word list). Founder's
 * explicit, repeated instruction: Denis serves guests "from around the
 * world" — a hand-rolled word list can only ever cover the
 * languages/phrasings a developer thought of (proven wrong within
 * minutes: Serbian alone has grammatical cases a simple word list
 * missed — "malu" vs "malo"). This schema is the LLM's OWN structured
 * perception of the guest's message, in whatever language they used —
 * it never decides a consequence, only observes. resolve-order-size-hint.ts
 * is the deterministic layer that turns this into an actual prompt hint,
 * always re-grounded against the REAL catalog (fuzzy-match confidence
 * gate), never trusting a raw guessed product name directly.
 */
export const OrderSizeIntentAssessmentSchema = z.object({
  /** True when the guest named (or clearly implied) one specific menu item, not a category. */
  namesSpecificProduct: z.boolean(),
  /** Guest's product name, normalized to how it'd likely appear on a menu — null if generic/unclear. */
  productNameGuess: z.string().max(100).nullable(),
  /** True when the guest asked for a category generically (e.g. "a beer", "some wine") without naming one item. */
  isGenericDrinkRequest: z.boolean(),
  /** Short English category label (e.g. "beer", "wine", "juice", "coffee") — null if not a drink request at all. */
  genericCategoryGuess: z.string().max(50).nullable(),
  /** Size preference expressed in ANY language/phrasing — the model's own understanding, not a fixed word list. */
  sizePreference: z.enum(["larger", "smaller", "unspecified"]),
  confidence: z.number().min(0).max(1),
  /** Exact substring that drove the classification — audit trail, prevents hallucinated justification. */
  quotedSpan: z.string().max(300),
});

export type OrderSizeIntentAssessment = z.infer<
  typeof OrderSizeIntentAssessmentSchema
>;
