import { shieldGuestInput } from "@/lib/ai/prompt-shield";
import { detectGuestScript } from "@/lib/denis/cognition/conversation/script-detector";
import {
  CORE_BELIEF_KEYS,
  getBeliefValue,
  type BeliefGraph,
} from "@/lib/denis/cognition/tde/turn-plan-types";
import {
  classifyGuestIntent,
  type SemanticIntentResult,
} from "@/lib/denis/cognition/tde/semantic-intent-router";

export type TurnComplexityBand = "simple" | "medium" | "complex" | "edge";

export type TurnComplexityScore = {
  /** 0 (trivial) → 10 (edge / adversarial) */
  score: number;
  band: TurnComplexityBand;
  reasons: string[];
  intent: SemanticIntentResult;
  injectionRisk: boolean;
  unknownScript: boolean;
};

const GROUP_ORDER =
  /\b(za\s+(mene|nju|njega|decu|dete|celu\s+porodicu|celu\s+porodicu)|for\s+(me|her|him|kids|family)|group\s+order|grupa|svima|party\s+of|za\s+cijeli\s+stol|različito|razlicito|different\s+for\s+each)\b/i;

const MODIFIER_RICH =
  /\b(bez|without|no\s+onions|medium\s+rare|well\s+done|gluten\s*free|vegan|extra|sauce|luk|luka|onion|allerg)\b/i;

const MULTI_ITEM =
  /\b\d+\s*[x×]\s*\w|\bi\s+\d+|\band\b|\bplus\b|\bte\s+još\b|\bund\b|,.*,/i;

const PRODUCT_PICK =
  /^(pilsner|weizen|pils|cola|kola|burger|pizza|espresso|latte|cevap|ćevap|pivo|beer|schnitzel)$/i;

const SUPPORTED_SCRIPTS = ["latin", "cyrillic"] as const;

function bandForScore(score: number): TurnComplexityBand {
  if (score <= 2) return "simple";
  if (score <= 5) return "medium";
  if (score <= 8) return "complex";
  return "edge";
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(10, Math.round(value)));
}

export type ScoreTurnComplexityInput = {
  message: string;
  beliefs?: BeliefGraph;
  /** Minimum score bump when TDE requires LLM on a short ack (e.g. recap confirm). */
  requiresLlm?: boolean;
  /** Prior mini-tier mistake on similar phrasing — auto-escalate +2. */
  escalationBump?: number;
};

/**
 * Score guest turn complexity 0–10 for adaptive model routing.
 * Deterministic — no LLM call.
 */
export function scoreTurnComplexity(
  input: ScoreTurnComplexityInput
): TurnComplexityScore {
  const trimmed = input.message.trim();
  const reasons: string[] = [];
  let score = 0;

  const intent = classifyGuestIntent(trimmed);

  if (!trimmed) {
    return {
      score: 0,
      band: "simple",
      reasons: ["empty"],
      intent,
      injectionRisk: false,
      unknownScript: false,
    };
  }

  const shield = shieldGuestInput(trimmed);
  const injectionRisk = shield != null && !shield.safe;
  if (injectionRisk) {
    score += 9;
    reasons.push(`injection:${shield?.reason ?? "blocked"}`);
  }

  const script = detectGuestScript(trimmed);
  const unknownScript = !SUPPORTED_SCRIPTS.includes(
    script.inputScript as (typeof SUPPORTED_SCRIPTS)[number]
  );
  if (unknownScript) {
    score += 4;
    reasons.push(`script:${script.inputScript}`);
  }

  if (intent.tier === "T0") {
    score = Math.max(score, intent.intent === "clarify_reply" ? 1 : 0);
    reasons.push(`intent.t0:${intent.intent}`);
  } else if (intent.tier === "T2") {
    const commerceSignal =
      MODIFIER_RICH.test(trimmed) ||
      MULTI_ITEM.test(trimmed) ||
      GROUP_ORDER.test(trimmed) ||
      intent.intent === "order" ||
      intent.intent === "browse";
    score += commerceSignal ? 2 : 5;
    reasons.push("intent.ambiguous");
  } else if (intent.intent === "complaint" || intent.intent === "handoff") {
    score += 5;
    reasons.push(`intent:${intent.intent}`);
  } else if (intent.intent === "smalltalk" && trimmed.length <= 20) {
    score += 1;
    reasons.push("intent:smalltalk");
  } else if (intent.intent === "settling" && trimmed.length <= 16) {
    score += 1;
    reasons.push("intent:settling");
  }

  if (PRODUCT_PICK.test(trimmed)) {
    score = Math.max(score, 1);
    reasons.push("product_pick");
  }

  if (GROUP_ORDER.test(trimmed)) {
    score = Math.max(score, 7);
    reasons.push("group_order");
  }

  if (MODIFIER_RICH.test(trimmed) && !GROUP_ORDER.test(trimmed)) {
    score = Math.max(score, 4);
    reasons.push("modifiers");
  } else if (MODIFIER_RICH.test(trimmed)) {
    reasons.push("modifiers");
  }

  const commaParts = trimmed.split(/[,;]/).filter((part) => part.trim());
  if (commaParts.length >= 3) {
    score += 2;
    reasons.push("multi_clause");
  }

  if (MULTI_ITEM.test(trimmed)) {
    score += trimmed.length > 30 ? 3 : 2;
    reasons.push("multi_item");
  }

  if (trimmed.length > 80) {
    score += 2;
    reasons.push("long_message");
  } else if (trimmed.length > 40) {
    score += 1;
    reasons.push("medium_length");
  }

  if (/\?/.test(trimmed) && trimmed.length > 30) {
    score += 1;
    reasons.push("question");
  }

  const pendingSlot = input.beliefs
    ? getBeliefValue<string>(input.beliefs, CORE_BELIEF_KEYS.commercePendingSlot)
    : null;
  if (pendingSlot && intent.tier === "T0") {
    score = Math.min(score, 2);
    reasons.push("pending_slot_t0");
  }

  if (input.requiresLlm && score <= 2) {
    score = 3;
    reasons.push("tde.requires_llm_floor");
  }

  if (input.escalationBump && input.escalationBump > 0) {
    score += input.escalationBump;
    reasons.push(`escalation:+${input.escalationBump}`);
  }

  const finalScore = clampScore(score);
  return {
    score: finalScore,
    band: bandForScore(finalScore),
    reasons,
    intent,
    injectionRisk,
    unknownScript,
  };
}

/** Map numeric score → legacy context-budget complexity label. */
export function complexityBandToLegacy(
  band: TurnComplexityBand
): "simple" | "moderate" | "complex" {
  if (band === "simple") return "simple";
  if (band === "medium") return "moderate";
  return "complex";
}
