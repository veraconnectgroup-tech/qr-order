import { callAgenticToolTurn } from "@/lib/denis/runtime/perceive/call-agentic-tool-turn";
import type { OpenAiChatMessage } from "@/lib/ai/types";
import {
  READ_ONLY_TOOL_CATALOG,
  listReadOnlyToolDefinitions,
  type AgenticToolExecutorInput,
  type AgenticToolName,
} from "@/lib/denis/agentic/tool-catalog";
import { logger } from "@/lib/logger";

export type ToolCallTrace = {
  name: string;
  arguments: string;
  result?: unknown;
  error?: string;
};

export type ToolLoopRoundTrace = {
  round: number;
  toolCalls: ToolCallTrace[];
};

export type ToolLoopResult = {
  /** Empty when hitRoundCap is true — caller must supply an honest fallback line (ADR-049 §4.3), never guess. */
  finalContent: string;
  rounds: ToolLoopRoundTrace[];
  hitRoundCap: boolean;
};

function isKnownTool(name: string): name is AgenticToolName {
  return name in READ_ONLY_TOOL_CATALOG;
}

/**
 * ADR-049 — bounded LLM-proposes/tool-executes loop. Round-capped by
 * design (never unbounded); a tool that errors or times out becomes a
 * first-class result the model sees, never a silently swallowed failure
 * the model could hallucinate success over.
 */
export async function runToolLoop(input: {
  messages: OpenAiChatMessage[];
  executorInput: AgenticToolExecutorInput;
  maxRounds: number;
  model?: string;
}): Promise<ToolLoopResult> {
  const messages = [...input.messages];
  const rounds: ToolLoopRoundTrace[] = [];
  const toolDefinitions = listReadOnlyToolDefinitions();

  for (let round = 1; round <= input.maxRounds; round++) {
    const result = await callAgenticToolTurn(messages, {
      model: input.model,
      tools: toolDefinitions,
      toolChoice: "auto",
    });

    if (!result.toolCalls?.length) {
      return { finalContent: result.content, rounds, hitRoundCap: false };
    }

    messages.push({ role: "assistant", content: result.content || "" });

    const roundTrace: ToolLoopRoundTrace = { round, toolCalls: [] };

    for (const call of result.toolCalls) {
      let toolResultPayload: unknown;
      let errorMessage: string | undefined;

      if (!isKnownTool(call.name)) {
        errorMessage = `unknown_tool:${call.name}`;
        toolResultPayload = { error: errorMessage };
      } else {
        try {
          const args = JSON.parse(call.arguments || "{}") as Record<
            string,
            unknown
          >;
          toolResultPayload = await READ_ONLY_TOOL_CATALOG[call.name].execute(
            input.executorInput,
            args
          );
        } catch (error) {
          errorMessage =
            error instanceof Error ? error.message : String(error);
          toolResultPayload = { error: "tool_failed" };
          logger.warn("agentic tool call failed", {
            tool: call.name,
            error: errorMessage,
          });
        }
      }

      roundTrace.toolCalls.push({
        name: call.name,
        arguments: call.arguments,
        result: toolResultPayload,
        error: errorMessage,
      });

      messages.push({
        role: "tool",
        toolCallId: call.id,
        content: JSON.stringify(toolResultPayload),
      });
    }

    rounds.push(roundTrace);
  }

  return { finalContent: "", rounds, hitRoundCap: true };
}
