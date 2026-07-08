import { apiSuccess } from "@/lib/api-response";
import type { OpenAiChatMessage } from "@/lib/ai/types";
import { buildDenisPersonaBlock } from "@/lib/denis/cognition/personality/denis-persona-block";
import type { TurnEvidencePack } from "@/lib/denis/cognition/context/plan-evidence";
import { defaultGuestChatFallback } from "@/lib/denis/cognition/tde";
import { mergeAgenticToolCatalog } from "@/lib/denis/agentic/merge-tool-catalog";
import { runToolLoop } from "@/lib/denis/agentic/run-tool-loop";
import type { DenisChatBody, DenisTurnContext } from "@/lib/denis/runtime/turn-types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiCatalog } from "@/lib/ai/catalog/catalog-types";

const AGENTIC_ROUND_CAP_FALLBACK: Record<string, string> = {
  sr: "Proveriću sa timom — trenutno nemam sve podatke. Možete li malo sačekati?",
  hr: "Provjerit ću s timom — trenutno nemam sve podatke. Možete li malo pričekati?",
  de: "Ich kläre das kurz mit dem Team — einen Moment bitte.",
  en: "Let me double-check with the team — I don't have everything confirmed yet.",
};

function agenticRoundCapFallback(language: string): string {
  return (
    AGENTIC_ROUND_CAP_FALLBACK[language] ??
    defaultGuestChatFallback(language)
  );
}

function buildAgenticMessages(input: {
  body: DenisChatBody;
  evidence: TurnEvidencePack;
  transcript?: Array<{ role: "user" | "assistant"; content: string }>;
}): OpenAiChatMessage[] {
  const systemParts = [
    buildDenisPersonaBlock(),
    "You are in live agentic mode: use tools to check real venue state before answering.",
    "Never claim you checked something unless a tool returned data.",
    "If a tool fails, say so honestly. Answer in the guest's language, briefly.",
    input.evidence.evidenceBlock,
  ].filter(Boolean);

  const messages: OpenAiChatMessage[] = [
    { role: "system", content: systemParts.join("\n\n") },
  ];

  for (const entry of input.transcript ?? []) {
    messages.push({ role: entry.role, content: entry.content });
  }

  messages.push({ role: "user", content: input.body.message });
  return messages;
}

export type AgenticLiveTurnResult = {
  ok: true;
  message: string;
  toolsCalled: string[];
  rounds: number;
  hitRoundCap: boolean;
};

export type AgenticLiveTurnError = {
  ok: false;
  error: string;
};

export async function runAgenticLiveTurn(input: {
  admin: SupabaseClient;
  ctx: DenisTurnContext;
  body: DenisChatBody;
  evidence: TurnEvidencePack;
  transcript?: Array<{ role: "user" | "assistant"; content: string }>;
  maxRounds: number;
  model?: string | null;
  catalog?: AiCatalog | null;
  aiSessionId?: string | null;
}): Promise<AgenticLiveTurnResult | AgenticLiveTurnError> {
  try {
    const loopResult = await runToolLoop({
      messages: buildAgenticMessages(input),
      executorInput: {
        admin: input.admin,
        ctx: input.ctx,
        dryRun: false,
        catalog: input.catalog ?? undefined,
        session:
          input.aiSessionId && input.body.sessionToken
            ? {
                aiSessionId: input.aiSessionId,
                sessionToken: input.body.sessionToken,
                tableToken: input.body.sessionToken,
                deviceFingerprint:
                  input.body.deviceFingerprint ?? "unknown-device-fp",
                deviceToken: input.body.deviceToken,
              }
            : undefined,
      },
      maxRounds: input.maxRounds,
      model: input.model ?? undefined,
      toolCatalog: mergeAgenticToolCatalog({ includeSideEffecting: true }),
    });

    const toolsCalled = loopResult.rounds.flatMap((round) =>
      round.toolCalls.map((call) => call.name)
    );

    const message = loopResult.hitRoundCap
      ? loopResult.finalContent.trim() ||
        agenticRoundCapFallback(input.body.language)
      : loopResult.finalContent.trim() ||
        defaultGuestChatFallback(input.body.language);

    return {
      ok: true,
      message,
      toolsCalled,
      rounds: loopResult.rounds.length,
      hitRoundCap: loopResult.hitRoundCap,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function buildAgenticLivePerceiveResponse(input: {
  message: string;
  sessionId?: string | null;
  language: string;
}) {
  return apiSuccess({
    message: input.message,
    recommendations: [],
    proposedItems: [],
    cartActions: [],
    quickReplies: [],
    submitOrder: false,
    intent: "chat" as const,
    sessionId: input.sessionId ?? undefined,
    structuredPerception: {
      intent: "chat",
      submitOrder: false,
      message: input.message,
      agenticLive: true,
    },
  });
}
