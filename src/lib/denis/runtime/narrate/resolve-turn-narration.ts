import type { NarrationFacts } from "@/lib/denis/runtime/narrate/narration-facts.schema";
import { shouldKeepLegacyConversationReply } from "@/lib/denis/runtime/narrate/has-committed-narration-facts";
import { narrateFromFacts } from "@/lib/denis/runtime/narrate/narrate-llm";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import type { ConciergeRolloutMode } from "@/lib/denis/config/rollout";
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
  /** Template obligation TELL — never replace with T3 narrator (ADR-033). */
  keepLegacyTell?: boolean;
}): Promise<ResolvedTurnNarration> {
  if (input.keepLegacyTell && input.legacyMessage.trim()) {
    return {
      draftMessage: input.legacyMessage,
      usedDenisNarrator: false,
      usedTemplateFallback: false,
    };
  }

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

  if (
    shouldKeepLegacyConversationReply(input.facts, input.legacyMessage)
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
