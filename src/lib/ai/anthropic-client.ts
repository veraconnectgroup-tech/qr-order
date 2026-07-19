import type { OpenAiCallResult, OpenAiChatMessage } from "@/lib/ai/types";
import { logger } from "@/lib/logger";
import {
  resetCircuitBreakerForTests,
  withCircuitBreaker,
} from "@/lib/resilience/circuit-breaker";

/**
 * Second model provider alongside openai-client.ts — added so Denis's
 * hardest turns (model tier "extended": group orders, conflicting
 * requests, prompt-injection attempts) can route to a genuinely stronger
 * model than whatever "full" uses, instead of the same model with one
 * extra sentence in the prompt. Deliberately mirrors OpenAiCallResult's
 * shape exactly so every downstream consumer (timeline logging, cost
 * tracking, retries) needs zero changes regardless of which provider
 * actually answered — see routeTurnModel's "provider:model" string
 * convention in model-router.ts, which is what picks between the two.
 */

const ANTHROPIC_MESSAGES_URL =
  process.env.ANTHROPIC_API_URL?.trim() ||
  "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export const ANTHROPIC_MODEL_PREFIX = "anthropic:";

export function isAnthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export function isAnthropicModel(model: string | undefined | null): boolean {
  return Boolean(model?.startsWith(ANTHROPIC_MODEL_PREFIX));
}

export function stripAnthropicPrefix(model: string): string {
  return model.startsWith(ANTHROPIC_MODEL_PREFIX)
    ? model.slice(ANTHROPIC_MODEL_PREFIX.length)
    : model;
}

export class AiAnthropicError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "AiAnthropicError";
    this.status = status;
  }
}

type AnthropicContentBlock = { type: string; text?: string };

type AnthropicMessagesResponse = {
  model?: string;
  content?: AnthropicContentBlock[];
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { message?: string };
};

/**
 * OpenAiChatMessage's flat {role, content}[] (system/user/assistant/tool)
 * maps onto Anthropic's shape, where system is a separate top-level field
 * and only user/assistant belong in `messages`. This call path (perceive's
 * extended tier) never sends tool-role messages — the agentic tool loop is
 * a separate flow that doesn't route through here today.
 */
function splitSystemAndTurns(messages: OpenAiChatMessage[]): {
  system: string;
  turns: Array<{ role: "user" | "assistant"; content: string }>;
} {
  let system = "";
  const turns: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const message of messages) {
    if (message.role === "system") {
      system = system ? `${system}\n\n${message.content}` : message.content;
      continue;
    }
    if (message.role === "tool") {
      // Not used by any current caller of this client — fold in as a user
      // note rather than dropping it silently if one ever appears.
      turns.push({ role: "user", content: message.content });
      continue;
    }
    turns.push({ role: message.role, content: message.content });
  }
  return { system, turns };
}

function extractText(content: AnthropicContentBlock[] | undefined): string {
  return (content ?? [])
    .filter((block) => block.type === "text" && block.text)
    .map((block) => block.text)
    .join("")
    .trim();
}

async function callAnthropicOnce(
  model: string,
  messages: OpenAiChatMessage[],
  signal: AbortSignal,
  callOptions?: { temperature?: number; maxTokens?: number }
): Promise<OpenAiCallResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new AiAnthropicError("Anthropic API key is not configured.");
  }

  const { system, turns } = splitSystemAndTurns(messages);

  const res = await fetch(ANTHROPIC_MESSAGES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model,
      system: system || undefined,
      messages: turns,
      max_tokens: callOptions?.maxTokens ?? 1200,
      temperature: callOptions?.temperature ?? 0.4,
    }),
    signal,
  });

  const body = (await res
    .json()
    .catch(() => ({}))) as AnthropicMessagesResponse;

  if (!res.ok) {
    throw new AiAnthropicError(
      body.error?.message ?? `Anthropic request failed (${res.status})`,
      res.status
    );
  }

  const content = extractText(body.content);
  if (!content) {
    throw new AiAnthropicError("Anthropic returned an empty response.");
  }

  const promptTokens = body.usage?.input_tokens ?? 0;
  const completionTokens = body.usage?.output_tokens ?? 0;

  return {
    content,
    tokensUsed: promptTokens + completionTokens,
    promptTokens,
    completionTokens,
    model: body.model ?? model,
  };
}

export async function callAnthropicChat(
  messages: OpenAiChatMessage[],
  options?: {
    model: string;
    temperature?: number;
    maxTokens?: number;
    requestTimeoutMs?: number;
  }
): Promise<OpenAiCallResult> {
  if (!isAnthropicConfigured()) {
    throw new AiAnthropicError("Anthropic is not configured.");
  }

  const model = stripAnthropicPrefix(options?.model ?? "");

  return withCircuitBreaker(
    "anthropic",
    async () => {
      const started = Date.now();
      try {
        const result = await callAnthropicOnce(
          model,
          messages,
          AbortSignal.timeout(options?.requestTimeoutMs ?? 15_000),
          { temperature: options?.temperature, maxTokens: options?.maxTokens }
        );
        logger.info("Anthropic chat completion", {
          model: result.model,
          tokensUsed: result.tokensUsed,
          latencyMs: Date.now() - started,
          status: "ok",
        });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn("Anthropic chat attempt failed", {
          model,
          latencyMs: Date.now() - started,
          status: "error",
          error: message,
        });
        throw error instanceof AiAnthropicError
          ? error
          : new AiAnthropicError(message);
      }
    },
    () => {
      throw new AiAnthropicError("Anthropic circuit open.");
    }
  );
}

/** Test helper — resets in-process circuit breaker state. */
export function resetAnthropicCircuitBreakerForTests() {
  resetCircuitBreakerForTests("anthropic");
}
