import { isOpenAiConfigured } from "@/lib/ai/config";
import { callOpenAiChat } from "@/lib/ai/openai-client";
import type { OpenAiChatMessage } from "@/lib/ai/types";
import { logger } from "@/lib/logger";
import {
  EndpointCapabilityAssessmentSchema,
  type EndpointCapabilityAssessment,
} from "@/lib/denis/integrations/capabilities/endpoint-capability-assessment-types";
import { DENIS_CAPABILITIES } from "@/lib/denis/integrations/capabilities/denis-capability-types";

/**
 * Pure perception, ADR-052 §1/§D — only called for endpoints
 * match-capability-heuristic.ts couldn't confidently classify from
 * structure alone (ambiguous path/method, or genuinely novel wording).
 * Never decides whether a capability is "supported" — that enforcement,
 * including the hard "no supported without quotedSpan" rule, lives in
 * capability-mapper.ts. Lives under cognition/perceive/ (not
 * integrations/discovery/, where the orchestrator lives) because it's
 * the only piece here that calls the OpenAI client — compliance.ts's
 * checkOpenAiBoundary restricts that to runtime/narrate/,
 * runtime/perceive/, and cognition/perceive/ only.
 */
function buildAssessmentMessages(input: {
  method: string;
  path: string;
  operationId: string | null;
  summary: string | null;
  description: string | null;
}): OpenAiChatMessage[] {
  const system = [
    "You classify ONE REST API endpoint (from an OpenAPI/Postman document) against a fixed list of restaurant-platform capabilities. You do not decide whether to use it — only whether it plausibly implements one of these capabilities.",
    `Known capabilities: ${DENIS_CAPABILITIES.join(", ")}.`,
    "capability: one of the known capabilities above, or \"none\" if this endpoint doesn't clearly implement any of them. Never force-fit the closest one — \"none\" is correct and expected for most endpoints in a general-purpose API.",
    "confidence: your own calibration, 0 to 1 — be honest, don't inflate it.",
    "quotedSpan: the exact operationId, summary, or description text that justified your answer. If capability is \"none\", quote whatever best explains why nothing fits.",
    'JSON only: {"capability":"order.create","confidence":0.8,"quotedSpan":"..."}',
  ].join("\n");

  const user = [
    `Method: ${input.method}`,
    `Path: ${input.path}`,
    `operationId: ${input.operationId ?? "(none)"}`,
    `summary: ${input.summary ?? "(none)"}`,
    `description: ${input.description ?? "(none)"}`,
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

export async function discoverEndpointCapability(input: {
  method: string;
  path: string;
  operationId: string | null;
  summary: string | null;
  description: string | null;
}): Promise<EndpointCapabilityAssessment | null> {
  if (!isOpenAiConfigured()) return null;

  try {
    const result = await callOpenAiChat(buildAssessmentMessages(input));
    const raw = JSON.parse(result.content) as unknown;
    const parsed = EndpointCapabilityAssessmentSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch (error) {
    logger.warn("discoverEndpointCapability failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
