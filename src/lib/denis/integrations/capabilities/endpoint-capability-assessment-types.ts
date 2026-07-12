import { z } from "zod";
import { DENIS_CAPABILITIES } from "@/lib/denis/integrations/capabilities/denis-capability-types";

/**
 * ADR-052 §D — structured LLM output for the endpoints
 * match-capability-heuristic.ts couldn't confidently classify. Same shape
 * discipline as GuestConductAssessmentSchema: no status/consequence
 * fields, only an observation the deterministic capability-mapper.ts
 * later decides what to do with. "none" is a first-class value — the
 * model must say "this endpoint isn't one of Denis's known capabilities"
 * rather than force-fitting the closest one.
 */
export const EndpointCapabilityAssessmentSchema = z.object({
  capability: z.union([z.enum(DENIS_CAPABILITIES), z.literal("none")]),
  confidence: z.number().min(0).max(1),
  /** Exact excerpt (operationId/summary/description) that justified the classification. */
  quotedSpan: z.string().max(300),
});

export type EndpointCapabilityAssessment = z.infer<
  typeof EndpointCapabilityAssessmentSchema
>;
