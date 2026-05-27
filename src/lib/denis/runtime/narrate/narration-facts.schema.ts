import { z } from "zod";

export const NarrationPairingSuggestionSchema = z.object({
  name: z.string().trim().min(1).max(120),
  price: z.string().trim().min(1).max(40),
  vkgReason: z.string().trim().max(300),
});

export const NarrationCommittedSchema = z.object({
  cartSummary: z.string().trim().max(500).optional(),
  addedItems: z.array(z.string().trim().min(1).max(120)).max(30).optional(),
  blockedReason: z.string().trim().max(300).optional(),
  orderNumber: z.number().int().positive().optional(),
  statusSummary: z.string().trim().max(300).optional(),
  pairingSuggestion: NarrationPairingSuggestionSchema.optional(),
  conflictQuestion: z.string().trim().max(400).optional(),
});

export const NarrationFactsSchema = z.object({
  persona: z.object({
    name: z.string().trim().min(1).max(40),
    tone: z.string().trim().min(1).max(40),
    maxWords: z.number().int().min(10).max(200),
  }),
  language: z.string().trim().min(2).max(10),
  goal: z.string().trim().min(1).max(40),
  committed: NarrationCommittedSchema,
  forbidden: z.array(z.string().trim().min(1).max(200)).max(50),
  /** Lint-only allowlist — product names the reply may mention. */
  allowedMentions: z.array(z.string().trim().min(1).max(120)).max(50),
});

export type NarrationFacts = z.infer<typeof NarrationFactsSchema>;
export type NarrationCommitted = z.infer<typeof NarrationCommittedSchema>;

export type NarrationTier = "template" | "T3";

export type NarrationLintIssue = {
  code:
    | "FORBIDDEN_PHRASE"
    | "UNALLOWED_PRODUCT"
    | "UNAUTHORIZED_SUBMIT"
    | "WORD_LIMIT"
    | "EMPTY_MESSAGE";
  detail: string;
};

export type NarrationLintResult = {
  ok: boolean;
  issues: NarrationLintIssue[];
};

export type SanitizedNarration = {
  message: string;
  tier: NarrationTier;
  lintPassed: boolean;
  issues: NarrationLintIssue[];
  usedFallback: boolean;
};
