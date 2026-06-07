import { AI_CONFIG, isOpenAiConfigured } from "@/lib/ai/config";
import { logger } from "@/lib/logger";

const OPENAI_EMBEDDINGS_URL =
  process.env.OPENAI_EMBEDDINGS_URL?.trim() ||
  process.env.OPENAI_API_URL?.trim()?.replace(/\/chat\/completions\/?$/i, "/embeddings") ||
  "https://api.openai.com/v1/embeddings";

export class AiEmbeddingError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "AiEmbeddingError";
    this.status = status;
  }
}

type EmbeddingsResponse = {
  data?: Array<{ embedding?: number[]; index?: number }>;
  error?: { message?: string };
};

export async function embedTextsWithOpenAi(
  texts: string[],
  options?: { model?: string }
): Promise<number[][]> {
  if (!texts.length) return [];
  if (!isOpenAiConfigured()) {
    throw new AiEmbeddingError("OpenAI API key is not configured.");
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new AiEmbeddingError("OpenAI API key is not configured.");
  }

  const model = options?.model ?? AI_CONFIG.embeddingModel;
  const started = Date.now();

  const res = await fetch(OPENAI_EMBEDDINGS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, input: texts }),
    signal: AbortSignal.timeout(AI_CONFIG.requestTimeoutMs),
  });

  const body = (await res.json().catch(() => ({}))) as EmbeddingsResponse;

  if (!res.ok) {
    throw new AiEmbeddingError(
      body.error?.message ?? `Embeddings request failed (${res.status})`,
      res.status
    );
  }

  const rows = [...(body.data ?? [])].sort(
    (a, b) => (a.index ?? 0) - (b.index ?? 0)
  );
  const vectors = rows.map((row) => row.embedding ?? []);

  if (vectors.length !== texts.length || vectors.some((row) => row.length === 0)) {
    throw new AiEmbeddingError("OpenAI returned incomplete embedding vectors.");
  }

  logger.info("OpenAI embeddings batch", {
    model,
    count: texts.length,
    latencyMs: Date.now() - started,
  });

  return vectors;
}
