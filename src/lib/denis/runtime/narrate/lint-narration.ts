import type {
  NarrationFacts,
  NarrationLintIssue,
  NarrationLintResult,
} from "@/lib/denis/runtime/narrate/narration-facts.schema";

const SUBMIT_CLAIM_PATTERNS = [
  /\bnarudžb(?:ina|inu)\s+(?:je\s+)?(?:poslat[a]?|potvrđen[a]?|submit)/iu,
  /\border\s+(?:is\s+)?(?:submitted|confirmed|placed)\b/i,
  /\bpošaljem\s+narudžbinu\b/iu,
  /\bsending\s+your\s+order\b/i,
];

const PRODUCT_LIKE_TOKEN =
  /\b[\p{L}][\p{L}\p{N}'-]{2,}\b/gu;

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function wordCount(message: string): number {
  return message.trim().split(/\s+/).filter(Boolean).length;
}

function containsForbiddenPhrase(
  message: string,
  forbidden: string[]
): NarrationLintIssue | null {
  const lower = message.toLowerCase();
  for (const phrase of forbidden) {
    const normalized = phrase.trim().toLowerCase();
    if (!normalized) continue;
    if (lower.includes(normalized)) {
      return {
        code: "FORBIDDEN_PHRASE",
        detail: `Forbidden phrase: ${phrase}`,
      };
    }
  }
  return null;
}

function containsUnauthorizedSubmit(
  message: string,
  facts: NarrationFacts
): NarrationLintIssue | null {
  if (facts.committed.orderNumber != null) return null;
  for (const pattern of SUBMIT_CLAIM_PATTERNS) {
    if (pattern.test(message)) {
      return {
        code: "UNAUTHORIZED_SUBMIT",
        detail: "Message claims submit without committed orderNumber",
      };
    }
  }
  return null;
}

function findUnallowedProductMentions(
  message: string,
  facts: NarrationFacts
): NarrationLintIssue | null {
  const allowed = new Set(facts.allowedMentions.map(normalize));
  if (allowed.size === 0) return null;

  const allowConflictQuestion =
    facts.committed.conflictQuestion?.toLowerCase() ?? "";
  const tokens = message.match(PRODUCT_LIKE_TOKEN) ?? [];
  const stopwords = new Set([
    "the",
    "and",
    "for",
    "with",
    "your",
    "you",
    "da",
    "je",
    "u",
    "i",
    "na",
    "za",
    "sam",
    "vidim",
    "chatu",
    "korpi",
    "korpu",
    "denis",
    "hello",
    "sorry",
    "dodao",
    "dodato",
    "added",
    "add",
    "cart",
    "recite",
    "predlog",
    "preporučujem",
    "preporucujem",
  ]);

  for (const token of tokens) {
    const lower = normalize(token);
    if (stopwords.has(lower)) continue;
    if (lower.length < 4) continue;
    if (allowConflictQuestion.includes(lower)) continue;
    if (allowed.has(lower)) continue;

    const partialAllowed = [...allowed].some(
      (name) => name.includes(lower) || lower.includes(name)
    );
    if (partialAllowed) continue;

    if (/^[A-Z]/.test(token) && !/^[A-Z][a-z]+$/.test(token)) {
      continue;
    }

    if (/^[A-Z][a-z]{3,}$/.test(token)) {
      return {
        code: "UNALLOWED_PRODUCT",
        detail: `Unallowed product mention: ${token}`,
      };
    }
  }

  return null;
}

/** Post-check T3 reply against committed facts (ADR-004 §11). */
export function lintNarrationMessage(
  message: string,
  facts: NarrationFacts
): NarrationLintResult {
  const issues: NarrationLintIssue[] = [];
  const trimmed = message.trim();

  if (!trimmed) {
    issues.push({ code: "EMPTY_MESSAGE", detail: "Empty narration" });
    return { ok: false, issues };
  }

  const forbidden = containsForbiddenPhrase(trimmed, facts.forbidden);
  if (forbidden) issues.push(forbidden);

  const submit = containsUnauthorizedSubmit(trimmed, facts);
  if (submit) issues.push(submit);

  const product = findUnallowedProductMentions(trimmed, facts);
  if (product) issues.push(product);

  if (wordCount(trimmed) > facts.persona.maxWords) {
    issues.push({
      code: "WORD_LIMIT",
      detail: `Message exceeds ${facts.persona.maxWords} words`,
    });
  }

  return { ok: issues.length === 0, issues };
}
