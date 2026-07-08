import type { OpenAiCallResult } from "@/lib/ai/types";
import {
  runToolLoop,
  type ToolLoopModelCall,
  type ToolLoopResult,
} from "@/lib/denis/agentic/run-tool-loop";
import {
  READ_ONLY_TOOL_CATALOG,
  type AgenticToolDefinition,
  type AgenticToolName,
} from "@/lib/denis/agentic/tool-catalog";
import { SIDE_EFFECTING_TOOL_CATALOG } from "@/lib/denis/agentic/side-effecting-tool-catalog";
import {
  TOOL_USE_SCENARIOS,
  type ToolUseScenario,
} from "@/lib/denis/eval/fixtures/tool-use/scenarios";
import type { DenisTurnContext } from "@/lib/denis/runtime/turn-types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ToolUseScenarioResult = {
  id: string;
  pass: boolean;
  errors: string[];
};

export type ToolUseFixtureReport = {
  ok: boolean;
  passed: number;
  total: number;
  results: ToolUseScenarioResult[];
};

const DEFAULT_MAX_ROUNDS = 3;

/** Same busy-kitchen fixture shape the unit tests use — venueOps is turn-context data, no DB. */
const EVAL_CTX = {
  locationId: "eval-loc-1",
  venueOps: {
    stationStress: [
      { station: "kitchen", stress: "busy", activeCount: 4, avgWaitMinutes: 18 },
      { station: "bar", stress: "normal", activeCount: 1, avgWaitMinutes: 3 },
    ],
  },
  tableSessionState: {
    table: { id: "eval-table-1", name: "Sto 1", token: "eval-table-token" },
    session: { id: "eval-session-1" },
  },
} as unknown as DenisTurnContext;

/** Any real DB touch in eval is a bug (dry-run must short-circuit first) — make it loud. */
const THROWING_ADMIN = new Proxy(
  {},
  {
    get() {
      throw new Error("eval_admin_touched");
    },
  }
) as SupabaseClient;

function scriptedModel(scenario: ToolUseScenario): ToolLoopModelCall {
  let callIndex = 0;
  return async (): Promise<OpenAiCallResult> => {
    const round = scenario.rounds[callIndex];
    callIndex += 1;
    if (!round) {
      throw new Error(
        `scenario ${scenario.id}: model called more times than scripted rounds`
      );
    }
    const base = {
      tokensUsed: 0,
      promptTokens: 0,
      completionTokens: 0,
      model: "scripted-eval",
    };
    if (round.kind === "final") {
      return { ...base, content: round.content };
    }
    return {
      ...base,
      content: "",
      toolCalls: round.toolCalls.map((call, i) => ({
        id: `call_${callIndex}_${i}`,
        name: call.name,
        arguments: call.arguments,
      })),
    };
  };
}

function buildEvalCatalog(
  failingTools: string[]
): Partial<Record<AgenticToolName, AgenticToolDefinition>> {
  const merged = {
    ...READ_ONLY_TOOL_CATALOG,
    ...SIDE_EFFECTING_TOOL_CATALOG,
  };
  const catalog: Partial<Record<AgenticToolName, AgenticToolDefinition>> = {};
  for (const [name, tool] of Object.entries(merged)) {
    catalog[name as AgenticToolName] = failingTools.includes(name)
      ? {
          ...tool,
          execute: async () => {
            throw new Error("simulated_tool_outage");
          },
        }
      : tool;
  }
  return catalog;
}

function checkScenario(
  scenario: ToolUseScenario,
  result: ToolLoopResult
): string[] {
  const errors: string[] = [];
  const allCalls = result.rounds.flatMap((round) => round.toolCalls);
  const executedNames = allCalls.map((call) => call.name);

  const expected = scenario.expect;
  if (JSON.stringify(executedNames) !== JSON.stringify(expected.toolsExecuted)) {
    errors.push(
      `toolsExecuted mismatch: got [${executedNames.join(", ")}], want [${expected.toolsExecuted.join(", ")}]`
    );
  }
  if (result.hitRoundCap !== expected.hitRoundCap) {
    errors.push(
      `hitRoundCap: got ${result.hitRoundCap}, want ${expected.hitRoundCap}`
    );
  }
  if (result.finalContent !== expected.finalContent) {
    errors.push(
      `finalContent: got ${JSON.stringify(result.finalContent)}, want ${JSON.stringify(expected.finalContent)}`
    );
  }

  for (const toolName of expected.toolsWithErrors ?? []) {
    const call = allCalls.find((c) => c.name === toolName);
    if (!call?.error) {
      errors.push(`expected first-class error on ${toolName}, found none`);
    }
  }

  for (const toolName of expected.dryRunTools ?? []) {
    const call = allCalls.find((c) => c.name === toolName);
    const payload = call?.result as { dryRun?: boolean } | undefined;
    if (!payload?.dryRun) {
      errors.push(
        `expected dryRun synthetic result on ${toolName} — a real side effect may have fired`
      );
    }
    if (call?.error) {
      errors.push(
        `dry-run ${toolName} carried an error (${call.error}) — dry-run must short-circuit before any real work`
      );
    }
  }

  return errors;
}

/** ADR-049 P3 gate — must be green before any location's loop leaves shadow. */
export async function runToolUseEvalSuite(): Promise<ToolUseFixtureReport> {
  const results: ToolUseScenarioResult[] = [];

  for (const scenario of TOOL_USE_SCENARIOS) {
    const loopResult = await runToolLoop({
      messages: [{ role: "user", content: scenario.guestMessage }],
      executorInput: { admin: THROWING_ADMIN, ctx: EVAL_CTX, dryRun: true },
      maxRounds: scenario.maxRounds ?? DEFAULT_MAX_ROUNDS,
      toolCatalog: buildEvalCatalog(scenario.failingTools ?? []),
      callModel: scriptedModel(scenario),
    });

    const errors = checkScenario(scenario, loopResult);
    results.push({ id: scenario.id, pass: errors.length === 0, errors });
  }

  const passed = results.filter((row) => row.pass).length;
  return {
    ok: passed === results.length,
    passed,
    total: results.length,
    results,
  };
}

export function formatToolUseEvalReport(report: ToolUseFixtureReport): string {
  const lines = [`tool-use eval: ${report.passed}/${report.total} passed`];
  for (const row of report.results) {
    if (row.pass) continue;
    lines.push(`  FAIL ${row.id}:`);
    for (const error of row.errors) lines.push(`    - ${error}`);
  }
  return lines.join("\n");
}
