import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import type { ConciergeRolloutMode } from "@/lib/denis/config/rollout";
import { narrateFromFacts } from "@/lib/denis/runtime/narrate/narrate-llm";
import type { NarrationFacts } from "@/lib/denis/runtime/narrate/narration-facts.schema";
import { shouldUseDenisNarration } from "@/lib/denis/runtime/narrate/should-use-denis-narration";
import { templateNarrationFallback } from "@/lib/denis/runtime/narrate/template-fallback";

export type ResolvedTurnNarration = {
  draftMessage: string;
  usedDenisNarrator: boolean;
  usedTemplateFallback: boolean;
};

/** Pick legacy vs Denis T3 narrator input before lint (M21). */
export async function resolveTurnNarrationMessage(input: {
  legacyMessage: string;
  facts: NarrationFacts;
  config: ConciergeConfig;
  rolloutMode: ConciergeRolloutMode;
  guestUsesLegacy?: boolean;
}): Promise<ResolvedTurnNarration> {
  if (
    !shouldUseDenisNarration(input.config, input.rolloutMode, {
      guestUsesLegacy: input.guestUsesLegacy,
    })
  ) {
    return {
      draftMessage: input.legacyMessage,
      usedDenisNarrator: false,
      usedTemplateFallback: false,
    };
  }

  const llmMessage = await narrateFromFacts(input.facts, input.config);
  if (llmMessage) {
    return {
      draftMessage: llmMessage,
      usedDenisNarrator: true,
      usedTemplateFallback: false,
    };
  }

  return {
    draftMessage: templateNarrationFallback(input.facts),
    usedDenisNarrator: true,
    usedTemplateFallback: true,
  };
}
