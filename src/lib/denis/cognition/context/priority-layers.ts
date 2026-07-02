import { estimateContextTokens } from "@/lib/denis/cognition/context/context-budget";

export type ContextPriority = "P0" | "P1" | "P2" | "P3";

const PRIORITY_RANK: Record<ContextPriority, number> = {
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3,
};

export type ContextLayerId =
  | "allergies"
  | "cart"
  | "active_gaps"
  | "recent_turns"
  | "menu_context"
  | "browse_history"
  | "browse_context"
  | "venue_ops"
  | "full_transcript"
  | "analytics"
  | "process"
  | "dialogue_frame"
  | "phase_behavior"
  | "active_memory"
  | "conversation_evidence"
  | "party"
  | "kitchen"
  | "bar"
  | "guest_intel"
  | "guest_mental_model"
  | "experience"
  | "external_context"
  | "loyalty"
  | "scroll"
  | "table_lifecycle";

export type TurnIntent =
  | "price_inquiry"
  | "ordering"
  | "social"
  | "status"
  | "allergy"
  | "browse"
  | "general";

export type ContextLayer = {
  priority: ContextPriority;
  id: ContextLayerId;
  content: string;
  tokenEstimate: number;
};

/** Infer what the guest turn is about — drives zero-waste layer selection. */
export function inferTurnIntent(guestMessage: string): TurnIntent {
  const msg = guestMessage.trim();
  if (!msg) return "general";

  if (/\b(alerg|allerg|gluten|intoleranc|bez\s+gluten)\b/i.test(msg)) {
    return "allergy";
  }
  if (
    /\b(koliko\s+(košta|je|cost)|cena|preis|price|€|eur|how\s+much)\b/i.test(
      msg
    )
  ) {
    return "price_inquiry";
  }
  if (
    /\b(status|gde\s+je|gdje\s+je|where|ready|spremno|čekam|wait\s+time|eta)\b/i.test(
      msg
    )
  ) {
    return "status";
  }
  if (
    /\b(preporu|meni|menu|naruč|order|daj|dva|tri|\d+\s*[x×]|burger|pivo|beer)\b/i.test(
      msg
    )
  ) {
    return "ordering";
  }
  if (/\b(scrol|browse|gledam|pogled|what\s+do\s+you\s+have|šta\s+imate)\b/i.test(msg)) {
    return "browse";
  }
  if (/^(da|ne|ok|hvala|thanks|super|može)[!.?]*$/i.test(msg)) {
    return "social";
  }
  return "general";
}

const ZERO_WASTE_SKIP: Partial<Record<TurnIntent, ContextLayerId[]>> = {
  price_inquiry: ["browse_history", "analytics", "scroll", "kitchen", "bar"],
  ordering: ["browse_history", "analytics", "scroll"],
  social: ["browse_history", "venue_ops", "analytics", "kitchen", "bar", "scroll"],
  status: ["browse_history", "menu_context", "analytics", "scroll"],
  browse: ["kitchen", "bar", "analytics", "cart"],
};

/** Drop layers the current turn will not use (zero-waste). */
export function filterLayersForIntent(
  layers: ContextLayer[],
  intent: TurnIntent,
  guestMessage?: string
): ContextLayer[] {
  const skip = new Set(ZERO_WASTE_SKIP[intent] ?? []);

  if (intent === "price_inquiry" && guestMessage) {
    if (!/\b(alerg|allerg|gluten|bez\s+\w+|without|ohne)\b/i.test(guestMessage)) {
      skip.add("allergies");
    }
  }

  if (intent === "ordering" && guestMessage) {
    if (!/\b(alerg|allerg|gluten|bez\s+\w+|without|ohne)\b/i.test(guestMessage)) {
      skip.add("allergies");
    }
  }

  return layers.filter((layer) => !skip.has(layer.id));
}

export type AssembledContext = {
  text: string;
  included: ContextLayer[];
  omitted: ContextLayer[];
  tokensUsed: number;
  prioritiesIncluded: ContextPriority[];
};

/**
 * Assemble context layers within token budget — P0 always first, then P1…
 */
export function assembleContextLayers(input: {
  layers: ContextLayer[];
  tokenBudget: number;
  intent?: TurnIntent;
  guestMessage?: string;
}): AssembledContext {
  let layers = input.layers.filter((layer) => layer.content.trim());

  if (input.intent) {
    layers = filterLayersForIntent(layers, input.intent, input.guestMessage);
  }

  layers.sort(
    (a, b) =>
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      a.tokenEstimate - b.tokenEstimate
  );

  const included: ContextLayer[] = [];
  const omitted: ContextLayer[] = [];
  let tokensUsed = 0;

  for (const layer of layers) {
    if (tokensUsed + layer.tokenEstimate <= input.tokenBudget) {
      included.push(layer);
      tokensUsed += layer.tokenEstimate;
      continue;
    }

    if (layer.priority === "P0") {
      included.push(layer);
      tokensUsed += layer.tokenEstimate;
      continue;
    }

    omitted.push(layer);
  }

  const prioritiesIncluded = [
    ...new Set(included.map((layer) => layer.priority)),
  ];

  return {
    text: included.map((layer) => layer.content).join("\n\n"),
    included,
    omitted,
    tokensUsed,
    prioritiesIncluded,
  };
}

export function createContextLayer(
  priority: ContextPriority,
  id: ContextLayerId,
  content: string
): ContextLayer | null {
  const trimmed = content.trim();
  if (!trimmed) return null;
  return {
    priority,
    id,
    content: trimmed,
    tokenEstimate: estimateContextTokens(trimmed),
  };
}
