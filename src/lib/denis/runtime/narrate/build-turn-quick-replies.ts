import type { ReflexTurnResult } from "@/lib/denis/kernel/reflex-plan";
import type {
  NarrationFacts,
  SanitizedNarration,
} from "@/lib/denis/runtime/narrate/narration-facts.schema";
import { sameAgainQuickReplyLabels } from "@/lib/guest/denis-guest-memory-messages";

const MAX_CHIPS = 6;

type ChipLabels = {
  yes: string;
  noThanks: string;
  confirm: string;
  addMore: string;
  merge: string;
};

function labelsForLanguage(language: string): ChipLabels {
  const lang = language.toLowerCase().slice(0, 2);
  if (lang === "de") {
    return {
      yes: "Ja",
      noThanks: "Nein, danke",
      confirm: "Bestätigen",
      addMore: "Noch etwas",
      merge: "Ja, zusammenlegen",
    };
  }
  if (lang === "en") {
    return {
      yes: "Yes",
      noThanks: "No thanks",
      confirm: "Confirm order",
      addMore: "Add more",
      merge: "Yes, merge",
    };
  }
  return {
    yes: "Da",
    noThanks: "Ne, hvala",
    confirm: "Potvrdi",
    addMore: "Još nešto",
    merge: "Da, spoji",
  };
}

function dedupeChips(chips: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const chip of chips) {
    const trimmed = chip.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

function hasCartContent(facts: NarrationFacts): boolean {
  return Boolean(
    facts.committed.cartSummary ||
      (facts.committed.addedItems?.length ?? 0) > 0
  );
}

function buildConflictChips(
  reflexTurn: ReflexTurnResult,
  labels: ChipLabels
): string[] {
  if (!reflexTurn.conflict?.hasConflict) return [];

  const conflicts = reflexTurn.conflict.conflicts;
  const hasManualOnly = conflicts.some((c) => c.kind === "manual_only");
  const hasAiOnly = conflicts.some((c) => c.kind === "ai_only");

  if (hasManualOnly && hasAiOnly) {
    return [labels.merge, labels.noThanks];
  }

  if (hasManualOnly || hasAiOnly) {
    return [labels.yes, labels.noThanks];
  }

  const duplicate = conflicts.find((c) => c.kind === "duplicate_line");
  if (duplicate?.kind === "duplicate_line") {
    return dedupeChips([
      String(duplicate.manual.quantity),
      String(duplicate.ai.quantity),
      labels.merge,
      labels.noThanks,
    ]).slice(0, 4);
  }

  return [labels.yes, labels.noThanks];
}

function buildGoalChips(facts: NarrationFacts, labels: ChipLabels): string[] {
  switch (facts.goal) {
    case "RECONCILE_CART":
      return [labels.merge, labels.noThanks];
    case "COMPLETE_ROUND":
      return hasCartContent(facts)
        ? [labels.confirm, labels.addMore, labels.noThanks]
        : [];
    case "HANDOFF":
      return [];
    default:
      return hasCartContent(facts)
        ? [labels.confirm, labels.addMore]
        : [];
  }
}

function buildTemplateChips(
  facts: NarrationFacts,
  narration: SanitizedNarration,
  labels: ChipLabels
): string[] {
  if (narration.tier !== "template" && !narration.usedFallback) return [];

  if (facts.committed.conflictQuestion) {
    return [labels.yes, labels.noThanks];
  }
  if (facts.committed.pairingSuggestion) {
    return [labels.yes, labels.noThanks];
  }
  if (facts.committed.addedItems?.length) {
    return [labels.confirm, labels.addMore];
  }
  if (facts.goal === "RECONCILE_CART") {
    return [labels.merge, labels.noThanks];
  }
  return [];
}

/** T0 UI chips — deterministic, never from LLM (M11). */
export function resolveTurnQuickReplies(input: {
  reflexTurn: ReflexTurnResult;
  facts: NarrationFacts;
  narration: SanitizedNarration;
  legacyQuickReplies?: string[];
  language?: string;
}): string[] {
  const labels = labelsForLanguage(input.language ?? "sr");
  const legacy = input.legacyQuickReplies ?? [];

  if (input.facts.committed.returnGuestWelcome) {
    const topItem = input.facts.allowedMentions?.[0] ?? null;
    const sameAgain = sameAgainQuickReplyLabels(
      input.language ?? "sr",
      topItem
    );
    return dedupeChips([sameAgain.sameAgain, sameAgain.somethingElse]).slice(
      0,
      MAX_CHIPS
    );
  }

  const conflictChips = buildConflictChips(input.reflexTurn, labels);
  if (conflictChips.length > 0) {
    return dedupeChips([...conflictChips, ...legacy]).slice(0, MAX_CHIPS);
  }

  const templateChips = buildTemplateChips(
    input.facts,
    input.narration,
    labels
  );
  if (templateChips.length > 0) {
    return dedupeChips([...templateChips, ...legacy]).slice(0, MAX_CHIPS);
  }

  const goalChips = buildGoalChips(input.facts, labels);
  if (goalChips.length > 0 && legacy.length === 0) {
    return goalChips.slice(0, MAX_CHIPS);
  }

  if (legacy.length === 0 && input.narration.lintPassed && goalChips.length > 0) {
    return goalChips.slice(0, MAX_CHIPS);
  }

  return legacy.slice(0, MAX_CHIPS);
}
