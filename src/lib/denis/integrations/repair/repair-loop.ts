import ts from "typescript";
import {
  runAdapterMethodInSandbox,
  type MockHttpResponse,
} from "@/lib/denis/integrations/sandbox/sandbox-runner";
import { proposeAdapterPatch } from "@/lib/denis/cognition/perceive/propose-adapter-patch";

/**
 * ADR-052 §H — bounded repair loop. LLM proposes (propose-adapter-patch.ts,
 * a full revised source per that module's documented deviation from the
 * ADR's literal "diff" wording), this module DECIDES: every proposal
 * must pass static validation before it's even allowed a real sandbox
 * run, and the whole loop has a hard round cap — same "propose, never
 * decide" split used everywhere else in this codebase (ACL, Guest
 * Conduct Policy Engine, agentic tool loop).
 *
 * No DB/audit-event writes here (integration_audit_events doesn't exist
 * on the live database yet — Phase 0's migration is written but not
 * applied). Every attempt is still returned in the result's `attempts`
 * array so a caller with DB access can persist it once that table is
 * live; this module itself stays storage-agnostic.
 */

const MAX_REPAIR_ROUNDS = 3;

export type RepairAttempt = {
  attemptNumber: number;
  proposed: boolean;
  explanation: string | null;
  validationPassed: boolean;
  sandboxPassed: boolean;
  error: string | null;
};

export type RepairLoopResult = {
  succeeded: boolean;
  finalSource: string;
  attempts: RepairAttempt[];
};

export type RepairLoopInput = {
  initialSource: string;
  adapterClassName: string;
  methodName: string;
  methodInput: Record<string, unknown>;
  methodConfig: Record<string, unknown>;
  mockResponses: MockHttpResponse[];
};

/**
 * Deliberately lighter than a real `tsc --noEmit` invocation (no
 * subprocess, no project-wide type resolution) — this only needs to
 * catch "the model returned something that doesn't even parse" or "the
 * model quietly renamed/removed the class this loop is patching," the
 * same two failure modes sandbox-runner.ts's own transpile step already
 * guards against for the ORIGINAL source. A real sandbox run (which
 * catches everything else, including actual logic bugs) is the next
 * gate right after this one, not a substitute for it.
 */
function validateSourceStatically(source: string, className: string): boolean {
  try {
    const transpiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
      reportDiagnostics: true,
    });
    if (transpiled.diagnostics && transpiled.diagnostics.length > 0) return false;
  } catch {
    return false;
  }
  return new RegExp(`\\bclass\\s+${className}\\b`).test(source);
}

export async function runAdapterRepairLoop(
  input: RepairLoopInput
): Promise<RepairLoopResult> {
  const attempts: RepairAttempt[] = [];

  let currentSource = input.initialSource;
  let lastError: string | null = null;

  const firstRun = await runAdapterMethodInSandbox({
    adapterSource: currentSource,
    adapterClassName: input.adapterClassName,
    methodName: input.methodName,
    methodInput: input.methodInput,
    methodConfig: input.methodConfig,
    mockResponses: input.mockResponses,
  });

  if (firstRun.ok) {
    return { succeeded: true, finalSource: currentSource, attempts };
  }
  lastError = firstRun.error;

  for (let round = 1; round <= MAX_REPAIR_ROUNDS; round += 1) {
    const proposal = await proposeAdapterPatch({
      currentSource,
      error: lastError,
      attemptNumber: round,
    });

    if (!proposal) {
      attempts.push({
        attemptNumber: round,
        proposed: false,
        explanation: null,
        validationPassed: false,
        sandboxPassed: false,
        error: lastError,
      });
      break;
    }

    const validationPassed = validateSourceStatically(
      proposal.revisedSource,
      input.adapterClassName
    );

    if (!validationPassed) {
      attempts.push({
        attemptNumber: round,
        proposed: true,
        explanation: proposal.explanation,
        validationPassed: false,
        sandboxPassed: false,
        error: lastError,
      });
      continue;
    }

    const sandboxResult = await runAdapterMethodInSandbox({
      adapterSource: proposal.revisedSource,
      adapterClassName: input.adapterClassName,
      methodName: input.methodName,
      methodInput: input.methodInput,
      methodConfig: input.methodConfig,
      mockResponses: input.mockResponses,
    });

    if (sandboxResult.ok) {
      attempts.push({
        attemptNumber: round,
        proposed: true,
        explanation: proposal.explanation,
        validationPassed: true,
        sandboxPassed: true,
        error: null,
      });
      return { succeeded: true, finalSource: proposal.revisedSource, attempts };
    }

    attempts.push({
      attemptNumber: round,
      proposed: true,
      explanation: proposal.explanation,
      validationPassed: true,
      sandboxPassed: false,
      error: sandboxResult.error,
    });
    currentSource = proposal.revisedSource;
    lastError = sandboxResult.error;
  }

  return { succeeded: false, finalSource: currentSource, attempts };
}
