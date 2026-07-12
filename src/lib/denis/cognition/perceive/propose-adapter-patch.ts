import { isOpenAiConfigured } from "@/lib/ai/config";
import { callOpenAiChat } from "@/lib/ai/openai-client";
import type { OpenAiChatMessage } from "@/lib/ai/types";
import { logger } from "@/lib/logger";

/**
 * ADR-052 §H — repair-loop perception step: proposes a fix for ONE
 * concrete sandbox failure, never a scope change. Pure perception, same
 * shape as assess-guest-conduct.ts/discover-endpoint-capability.ts —
 * this function never decides whether the fix is safe to try, only
 * drafts one; run-adapter-repair-loop.ts's static-validation + real
 * sandbox re-run is what decides.
 *
 * Deliberate deviation from ADR-052 §H's literal wording ("PATCH,
 * unified diff, not a new file — smaller error surface"): this returns
 * a full revised source string instead. Reasoning: the generated
 * adapter is a single small, template-shaped file, and this codebase
 * has no existing diff-apply mechanism to build on — introducing one
 * (and its own parsing/context-matching failure modes) for a file this
 * size is a bigger real error surface than having the model rewrite the
 * whole thing and validating the result the same way sandbox-runner.ts
 * already validates the original. Every attempt is still capped and
 * every attempt's source is still recorded (run-adapter-repair-loop.ts),
 * preserving the audit intent behind the original wording.
 */
export type AdapterPatchProposal = {
  revisedSource: string;
  explanation: string;
};

function buildPatchMessages(input: {
  currentSource: string;
  error: string;
  attemptNumber: number;
}): OpenAiChatMessage[] {
  const system = [
    "You fix ONE narrow class of bug in a generated TypeScript API adapter: a wrong field name, wrong HTTP method, missing/wrong header, wrong type coercion, or an off-by-one in a URL path — the kind of mistake that produces exactly the error shown below.",
    "You do NOT add new capabilities, new methods, new imports, or change what the adapter is scoped to do. You do NOT remove the safety comments at the top of the file. You do NOT change the class name or the names of existing methods.",
    "Return the COMPLETE corrected file, not a diff or a partial snippet — the caller replaces the whole file with what you return.",
    'JSON only: {"revisedSource":"<the full corrected TypeScript source>","explanation":"<one sentence, what you changed and why>"}',
  ].join("\n");

  const user = [
    `Attempt ${input.attemptNumber} of 3.`,
    `The adapter below failed when actually run against a mock response, with this error:`,
    input.error,
    "",
    "Current source:",
    "```typescript",
    input.currentSource,
    "```",
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

export async function proposeAdapterPatch(input: {
  currentSource: string;
  error: string;
  attemptNumber: number;
}): Promise<AdapterPatchProposal | null> {
  if (!isOpenAiConfigured()) return null;

  try {
    const result = await callOpenAiChat(buildPatchMessages(input));
    const raw = JSON.parse(result.content) as unknown;
    if (
      !raw ||
      typeof raw !== "object" ||
      typeof (raw as Record<string, unknown>).revisedSource !== "string" ||
      typeof (raw as Record<string, unknown>).explanation !== "string"
    ) {
      return null;
    }
    const parsed = raw as { revisedSource: string; explanation: string };
    if (!parsed.revisedSource.trim()) return null;
    return parsed;
  } catch (error) {
    logger.warn("proposeAdapterPatch failed", {
      attemptNumber: input.attemptNumber,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
