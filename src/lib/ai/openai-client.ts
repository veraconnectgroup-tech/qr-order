import { AI_CONFIG, isOpenAiConfigured } from "@/lib/ai/config";
import { StreamingJsonStringFieldExtractor } from "@/lib/ai/streaming-json-field-extractor";
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
    prompt_tokens_details?: { cached_tokens?: number };
  };
  error?: { message?: string };
};

async function callOpenAiOnce(
  model: string,
  messages: OpenAiChatMessage[],
  signal: AbortSignal,
  callOptions?: {
    temperature?: number;
    maxTokens?: number;
    promptCacheKey?: string;
  }
): Promise<OpenAiCallResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new AiOpenAiError("OpenAI API key is not configured.");
  }

  const bodyPayload: Record<string, unknown> = {
    model,
    messages,
    temperature: callOptions?.temperature ?? AI_CONFIG.temperature,
    max_tokens: callOptions?.maxTokens ?? AI_CONFIG.maxTokens,
    response_format: { type: "json_object" },
  };

  if (
    AI_CONFIG.promptCachingEnabled &&
    callOptions?.promptCacheKey?.trim()
  ) {
    bodyPayload.prompt_cache_key = callOptions.promptCacheKey.trim();
  }

  const res = await fetch(OPENAI_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(bodyPayload),
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
    cachedPromptTokens: body.usage?.prompt_tokens_details?.cached_tokens,
    model: body.model ?? model,
  };
}

async function callOpenAiWithRetries(
  messages: OpenAiChatMessage[],
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    promptCacheKey?: string;
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
            promptCacheKey: options?.promptCacheKey,
          }
        );

        logger.info("OpenAI chat completion", {
          model: result.model,
          tokensUsed: result.tokensUsed,
          cachedPromptTokens: result.cachedPromptTokens ?? 0,
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
    promptCacheKey?: string;
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

async function callOpenAiOnceStreaming(
  model: string,
  messages: OpenAiChatMessage[],
  signal: AbortSignal,
  onMessageDelta: (text: string) => void,
  callOptions?: {
    temperature?: number;
    maxTokens?: number;
    promptCacheKey?: string;
  }
): Promise<OpenAiCallResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new AiOpenAiError("OpenAI API key is not configured.");
  }

  const bodyPayload: Record<string, unknown> = {
    model,
    messages,
    temperature: callOptions?.temperature ?? AI_CONFIG.temperature,
    max_tokens: callOptions?.maxTokens ?? AI_CONFIG.maxTokens,
    response_format: { type: "json_object" },
    stream: true,
    stream_options: { include_usage: true },
  };

  if (
    AI_CONFIG.promptCachingEnabled &&
    callOptions?.promptCacheKey?.trim()
  ) {
    bodyPayload.prompt_cache_key = callOptions.promptCacheKey.trim();
  }

  const res = await fetch(OPENAI_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(bodyPayload),
    signal,
  });

  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => ({}))) as ChatCompletionResponse;
    throw new AiOpenAiError(
      body.error?.message ?? `OpenAI request failed (${res.status})`,
      res.status
    );
  }

  const extractor = new StreamingJsonStringFieldExtractor("message");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullContent = "";
  let resolvedModel = model;
  let usage: ChatCompletionResponse["usage"];
  let sseBuffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      sseBuffer += decoder.decode(value, { stream: true });

      const lines = sseBuffer.split("\n");
      sseBuffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice("data:".length).trim();
        if (payload === "[DONE]") continue;

        let event: {
          model?: string;
          choices?: Array<{ delta?: { content?: string } }>;
          usage?: ChatCompletionResponse["usage"];
        };
        try {
          event = JSON.parse(payload);
        } catch {
          continue;
        }

        if (event.model) resolvedModel = event.model;
        if (event.usage) usage = event.usage;

        const delta = event.choices?.[0]?.delta?.content;
        if (delta) {
          fullContent += delta;
          const revealed = extractor.push(delta);
          if (revealed) onMessageDelta(revealed);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  const content = fullContent.trim();
  if (!content) {
    throw new AiOpenAiError("OpenAI returned an empty response.");
  }

  const tokensUsed =
    usage?.total_tokens ??
    (usage?.prompt_tokens ?? 0) + (usage?.completion_tokens ?? 0);

  return {
    content,
    tokensUsed,
    promptTokens: usage?.prompt_tokens ?? 0,
    completionTokens: usage?.completion_tokens ?? 0,
    cachedPromptTokens: usage?.prompt_tokens_details?.cached_tokens,
    model: resolvedModel,
  };
}

/**
 * Streaming variant of `callOpenAiChat` — reveals the guest-facing `message`
 * field as it's generated via `onMessageDelta`, while still returning the
 * exact same `OpenAiCallResult` shape once the full JSON is complete, so
 * every downstream consumer (parsing, guards, ordering) is unchanged.
 *
 * No cross-model retry: a mid-stream failure means text may already be
 * visible to the guest, so the caller must fall back to an error state
 * rather than silently re-requesting a second reply.
 */
export async function callOpenAiChatStreaming(
  messages: OpenAiChatMessage[],
  onMessageDelta: (text: string) => void,
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    extendedThinking?: boolean;
    promptCacheKey?: string;
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
    () =>
      callOpenAiOnceStreaming(
        callOptions?.model ?? AI_CONFIG.model,
        messages,
        AbortSignal.timeout(AI_CONFIG.requestTimeoutMs),
        onMessageDelta,
        {
          temperature: callOptions?.temperature,
          maxTokens: callOptions?.maxTokens,
          promptCacheKey: callOptions?.promptCacheKey,
        }
      ),
    () => {
      throw new AiCircuitOpenError();
    }
  );
}

/** Test helper — resets in-process circuit breaker state. */
export function resetAiCircuitBreakerForTests() {
  resetCircuitBreakerForTests("openai");
}
