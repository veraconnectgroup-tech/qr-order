import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import type { ReflexTurnResult } from "@/lib/denis/kernel/reflex-plan";
import type { NarrationFacts } from "@/lib/denis/runtime/narrate/narration-facts.schema";

function uniqueNames(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of names) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

function cartSummaryFromLines(
  lines: Array<{ productName: string; quantity: number }>
): string | undefined {
  if (lines.length === 0) return undefined;
  return lines
    .map((line) =>
      line.quantity > 1
        ? `${line.quantity}× ${line.productName}`
        : line.productName
    )
    .join(", ");
}

export type BuildNarrationFactsInput = {
  config: ConciergeConfig;
  language: string;
  reflexTurn: ReflexTurnResult;
  cartActions?: Array<{ productName: string; quantity?: number }>;
  recommendations?: Array<{ productName?: string; name?: string }>;
  orderNumber?: number | null;
  statusSummary?: string | null;
  blockedReason?: string | null;
};

/** Build strict T3 fact bundle before narration lint (ADR-004 §11). */
export function buildNarrationFacts(
  input: BuildNarrationFactsInput
): NarrationFacts {
  const topGoal = input.reflexTurn.plan.topGoal?.type ?? "OPEN_TABLE";
  const addedItems = uniqueNames(
    (input.cartActions ?? []).map((action) => action.productName)
  );

  const cartLines = (input.cartActions ?? []).map((action) => ({
    productName: action.productName,
    quantity: action.quantity ?? 1,
  }));

  const recommendationNames = uniqueNames(
    (input.recommendations ?? []).flatMap((rec) => [
      rec.productName ?? "",
      rec.name ?? "",
    ])
  );

  const draftItems = input.reflexTurn.cartState.draft.items.map(
    (line) => line.productName
  );

  const allowedMentions = uniqueNames([
    ...addedItems,
    ...recommendationNames,
    ...draftItems,
  ]);

  const committed: NarrationFacts["committed"] = {};

  const summary = cartSummaryFromLines(cartLines);
  if (summary) committed.cartSummary = summary;
  if (addedItems.length > 0) committed.addedItems = addedItems;
  if (input.blockedReason) committed.blockedReason = input.blockedReason;
  if (input.orderNumber != null) committed.orderNumber = input.orderNumber;
  if (input.statusSummary) committed.statusSummary = input.statusSummary;
  if (input.reflexTurn.conflict?.guestPrompt) {
    committed.conflictQuestion = input.reflexTurn.conflict.guestPrompt;
    allowedMentions.push(
      ...extractMentionCandidates(input.reflexTurn.conflict.guestPrompt)
    );
  }

  return {
    persona: {
      name: input.config.persona.name,
      tone: input.config.persona.tone,
      maxWords: input.config.persona.maxWordsPerReply,
    },
    language: input.language,
    goal: topGoal,
    committed,
    forbidden: [...input.config.persona.forbiddenPhrases],
    allowedMentions: uniqueNames(allowedMentions),
  };
}

function extractMentionCandidates(text: string): string[] {
  return text
    .split(/\s+/)
    .map((token) => token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
    .filter((token) => token.length >= 3);
}
