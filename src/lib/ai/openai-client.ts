import { AI_CONFIG, isOpenAiConfigured } from "@/lib/ai/config";
import type { OpenAiCallResult, OpenAiChatMessage } from "@/lib/ai/types";
import { logger } from "@/lib/logger";
import {
  resetCircuitBreakerForTests,
  withCircuitBreaker,
} from "@/lib/resilience/circuit-breaker";

const OPENAI_CHAT_URL =
  process.env.OPENAI_API_URL?.trim() ||
  "https://api.openai.com/v1/chat/completions";

export class AiCircuitOpenError extends Error {
  constructor() {
    super("AI service temporarily unavailable.");
    this.name = "AiCircuitOpenError";
  }
}

export class AiOpenAiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "AiOpenAiError";
    this.status = status;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type ChatCompletionResponse = {
  model?: string;
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: {
    total_tokens?: number;
    prompt_tokens?: number;
    completion_tokens?: number;
  };
  error?: { message?: string };
};

async function callOpenAiOnce(
  model: string,
  messages: OpenAiChatMessage[],
  signal: AbortSignal,
  callOptions?: { temperature?: number; maxTokens?: number }
): Promise<OpenAiCallResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new AiOpenAiError("OpenAI API key is not configured.");
  }

  const res = await fetch(OPENAI_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: callOptions?.temperature ?? AI_CONFIG.temperature,
      max_tokens: callOptions?.maxTokens ?? AI_CONFIG.maxTokens,
      response_format: { type: "json_object" },
    }),
    signal,
  });

  const body = (await res.json().catch(() => ({}))) as ChatCompletionResponse;

  if (!res.ok) {
    throw new AiOpenAiError(
      body.error?.message ?? `OpenAI request failed (${res.status})`,
      res.status
    );
  }

  const content = body.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new AiOpenAiError("OpenAI returned an empty response.");
  }

  const tokensUsed =
    body.usage?.total_tokens ??
    (body.usage?.prompt_tokens ?? 0) + (body.usage?.completion_tokens ?? 0);

  return {
    content,
    tokensUsed,
    promptTokens: body.usage?.prompt_tokens ?? 0,
    completionTokens: body.usage?.completion_tokens ?? 0,
    model: body.model ?? model,
  };
}

async function callOpenAiWithRetries(
  messages: OpenAiChatMessage[],
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }
): Promise<OpenAiCallResult> {
  const primaryModel = options?.model ?? AI_CONFIG.model;
  const models = [primaryModel];
  if (primaryModel !== AI_CONFIG.fallbackModel) {
    models.push(AI_CONFIG.fallbackModel);
  }

  let lastError: unknown;

  for (const model of models) {
    for (let attempt = 1; attempt <= AI_CONFIG.maxRetryAttempts; attempt++) {
      const started = Date.now();

      try {
        const result = await callOpenAiOnce(
          model,
          messages,
          AbortSignal.timeout(AI_CONFIG.requestTimeoutMs),
          {
            temperature: options?.temperature,
            maxTokens: options?.maxTokens,
          }
        );

        logger.info("OpenAI chat completion", {
          model: result.model,
          tokensUsed: result.tokensUsed,
          latencyMs: Date.now() - started,
          status: "ok",
          attempt,
        });

        return result;
      } catch (error) {
        lastError = error;
        const latencyMs = Date.now() - started;
        const message = error instanceof Error ? error.message : String(error);

        logger.warn("OpenAI chat attempt failed", {
          model,
          attempt,
          latencyMs,
          status: "error",
          error: message,
        });

        if (attempt < AI_CONFIG.maxRetryAttempts) {
          const delay =
            AI_CONFIG.retryBaseDelayMs * Math.pow(2, attempt - 1);
          await sleep(delay);
        }
      }
    }
  }

  if (lastError instanceof AiOpenAiError) {
    throw lastError;
  }

  throw new AiOpenAiError(
    lastError instanceof Error ? lastError.message : "OpenAI request failed."
  );
}

export async function callOpenAiChat(
  messages: OpenAiChatMessage[],
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    extendedThinking?: boolean;
  }
): Promise<OpenAiCallResult> {
  if (!isOpenAiConfigured()) {
    throw new AiOpenAiError("OpenAI is not configured.");
  }

  const callOptions = options?.extendedThinking
    ? {
        temperature: 0.2,
        maxTokens: Math.max(AI_CONFIG.maxTokens, 1200),
        ...options,
      }
    : options;

  return withCircuitBreaker(
    "openai",
    () => callOpenAiWithRetries(messages, callOptions),
    () => {
      throw new AiCircuitOpenError();
    }
  );
}

/** Test helper — resets in-process circuit breaker state. */
export function resetAiCircuitBreakerForTests() {
  resetCircuitBreakerForTests("openai");
}
