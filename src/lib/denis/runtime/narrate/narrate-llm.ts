import { isOpenAiConfigured, buildDenisPromptCacheKey } from "@/lib/ai/config";
import { callOpenAiChat } from "@/lib/ai/openai-client";
import type { OpenAiChatMessage } from "@/lib/ai/types";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import type { NarrationFacts } from "@/lib/denis/runtime/narrate/narration-facts.schema";
import { logger } from "@/lib/logger";

const NARRATE_RESPONSE_SCHEMA = {
  message: "string — guest-facing reply, facts only",
} as const;

function narrationGoalHint(goal: string): string {
  if (goal === "GUEST_SEATED") {
    return "GUEST_SEATED (guest already scanned table QR — help order; not a reservation desk)";
  }
  return goal;
}

function factsPayloadForPrompt(facts: NarrationFacts): Record<string, unknown> {
  return {
    language: facts.language,
    goal: narrationGoalHint(facts.goal),
    committed: facts.committed,
    persona: {
      name: facts.persona.name,
      tone: facts.persona.tone,
      maxWords: facts.persona.maxWords,
    },
    forbiddenPhrases: facts.forbidden,
    allowedProductMentions: facts.allowedMentions,
  };
}

export function buildNarrateLlmMessages(
  facts: NarrationFacts
): OpenAiChatMessage[] {
  const system = [
    "You are a head waiter at the table (T3). You ONLY speak committed facts.",
    "Sound natural and human — never like a shop checkout or app UI.",
    "Never say cart, korpa, košarica, Warenkorb, added to cart, or dodato u korpu.",
    "Never propose changes, never claim submit, never invent products.",
    `Respond in language code "${facts.language}".`,
    `Max ${facts.persona.maxWords} words. Tone: ${facts.persona.tone}.`,
    `Output JSON only: ${JSON.stringify(NARRATE_RESPONSE_SCHEMA)}`,
  ].join(" ");

  return [
    { role: "system", content: system },
    {
      role: "user",
      content: JSON.stringify({ facts: factsPayloadForPrompt(facts) }),
    },
  ];
}

function parseNarrateResponse(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw) as { message?: unknown };
    if (typeof parsed.message !== "string") return null;
    const trimmed = parsed.message.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

/**
 * M21 — facts-only T3 narration via OpenAI (allowed path under runtime/narrate/).
 * Returns null on misconfiguration or failure — caller uses template fallback.
 */
export async function narrateFromFacts(
  facts: NarrationFacts,
  config: ConciergeConfig
): Promise<string | null> {
  if (!isOpenAiConfigured()) {
    return null;
  }

  const model =
    config.llm.model?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    undefined;

  try {
    const result = await callOpenAiChat(buildNarrateLlmMessages(facts), {
      model,
      promptCacheKey: buildDenisPromptCacheKey("narrate"),
    });
    return parseNarrateResponse(result.content);
  } catch (error) {
    logger.warn("narrateFromFacts failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
