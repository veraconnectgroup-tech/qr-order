import { callOpenAiChat } from "@/lib/ai/openai-client";
import type { OpenAiCallResult, OpenAiChatMessage, OpenAiToolDefinition } from "@/lib/ai/types";

/**
 * ADR-049 — the sole OpenAI call site for the agentic tool-use loop.
 * Architecture boundary (denis-architecture-compliance.test.ts) requires
 * every OpenAI client call under src/lib/denis to live in
 * runtime/narrate/, runtime/perceive/, or cognition/perceive/ — this is
 * that home for the tool loop; src/lib/denis/agentic/run-tool-loop.ts
 * calls this instead of the client directly.
 */
export async function callAgenticToolTurn(
  messages: OpenAiChatMessage[],
  options: {
    model?: string;
    tools: OpenAiToolDefinition[];
    toolChoice?: "auto" | "none";
  }
): Promise<OpenAiCallResult> {
  return callOpenAiChat(messages, options);
}
