import { callAgenticToolTurn } from "@/lib/denis/runtime/perceive/call-agentic-tool-turn";
import type {
  OpenAiCallResult,
  OpenAiChatMessage,
  OpenAiToolDefinition,
} from "@/lib/ai/types";
import {
  READ_ONLY_TOOL_CATALOG,
  type AgenticToolDefinition,
  type AgenticToolExecutorInput,
  type AgenticToolName,
} from "@/lib/denis/agentic/tool-catalog";
import { logger } from "@/lib/logger";

type ToolCatalog = Partial<Record<AgenticToolName, AgenticToolDefinition>>;

/** Model transport for one loop round — injectable so evals/tests can script rounds deterministically (no network). */
export type ToolLoopModelCall = (
  messages: OpenAiChatMessage[],
  options: {
    model?: string;
    tools: OpenAiToolDefinition[];
    toolChoice?: "auto" | "none";
  }
) => Promise<OpenAiCallResult>;

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

/**
 * ADR-049 — bounded LLM-proposes/tool-executes loop. Round-capped by
 * design (never unbounded); a tool that errors or times out becomes a
 * first-class result the model sees, never a silently swallowed failure
 * the model could hallucinate success over.
 *
 * Defaults to the read-only catalog only — P1's existing shadow wiring
 * keeps behaving exactly as before. Pass a wider catalog (e.g. merging
 * in SIDE_EFFECTING_TOOL_CATALOG) explicitly to opt in; executorInput.dryRun
 * is the caller's responsibility to set correctly either way (ADR-049 §4.3).
 */
export async function runToolLoop(input: {
  messages: OpenAiChatMessage[];
  executorInput: AgenticToolExecutorInput;
  maxRounds: number;
  model?: string;
  toolCatalog?: ToolCatalog;
  /** Eval/test injection point — defaults to the real OpenAI call. */
  callModel?: ToolLoopModelCall;
}): Promise<ToolLoopResult> {
  const messages = [...input.messages];
  const rounds: ToolLoopRoundTrace[] = [];
  const catalog: ToolCatalog = input.toolCatalog ?? READ_ONLY_TOOL_CATALOG;
  const toolDefinitions = Object.values(catalog).map((tool) => tool!.definition);
  const callModel = input.callModel ?? callAgenticToolTurn;

  for (let round = 1; round <= input.maxRounds; round++) {
    const result = await callModel(messages, {
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
      const tool = catalog[call.name as AgenticToolName];

      if (!tool) {
        errorMessage = `unknown_tool:${call.name}`;
        toolResultPayload = { error: errorMessage };
      } else {
        try {
          const args = JSON.parse(call.arguments || "{}") as Record<
            string,
            unknown
          >;
          toolResultPayload = await tool.execute(input.executorInput, args);
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
