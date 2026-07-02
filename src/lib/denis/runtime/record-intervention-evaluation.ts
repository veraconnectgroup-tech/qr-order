import { resolveInterventionManifest } from "@/lib/denis/cognition/intervention/resolve-intervention-manifest";
import {
  buildInterventionJournalPayload,
  evaluateInterventionPipeline,
  resolveInterventionDeclineReason,
  shouldRecordInterventionSuperseded,
} from "@/lib/denis/cognition/intervention/run-intervention-pipeline";
import type { InterventionDecision } from "@/lib/denis/cognition/intervention/intervention-types";
import type { TableLifecycleOrchestration } from "@/lib/denis/cognition/lifecycle/table-lifecycle-types";
import type { TableTempoPhase } from "@/lib/denis/cognition/tempo/detect-table-tempo-phase";
import type { ProactiveTurnResult } from "@/lib/denis/cognition/proactive/plan-proactive-turn";
import {
  isInterventionJournalActive,
  resolveInterventionMode,
} from "@/lib/denis/config/resolve-intervention-mode";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import type { TableSessionState } from "@/lib/denis/loop/types";
import {
  projectInterventionCommittedToCommerce,
  projectInterventionDeclinedToCommerce,
  projectInterventionEvaluatedToCommerce,
  projectInterventionExpiredToCommerce,
  projectInterventionSupersededToCommerce,
} from "@/lib/commerce/projections/project-intervention-journal";
import { createTurnTraceId } from "@/lib/denis/platform/timeline-types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type InterventionJournalContext = {
  interventionId: string;
  traceId: string;
  evaluation: ReturnType<typeof evaluateInterventionPipeline>;
};

/** Record IJS shadow/enforce evaluation + lifecycle to commerce journal (ADR-041). */
export async function recordInterventionEvaluation(
  admin: SupabaseClient,
  input: {
    aiSessionId: string;
    tableSessionId: string;
    config: ConciergeConfig;
    state: TableSessionState;
    proactiveResult: ProactiveTurnResult;
    source: string;
    traceId?: string;
    previousDecision?: InterventionDecision | null;
    previousInterventionId?: string | null;
    deferExpired?: boolean;
    tableTempoPhase?: TableTempoPhase;
    lifecycle?: TableLifecycleOrchestration | null;
  }
): Promise<InterventionJournalContext | null> {
  if (!isInterventionJournalActive(input.config)) {
    return null;
  }

  const mode = resolveInterventionMode(input.config);
  const manifest = resolveInterventionManifest(input.config);
  const evaluation = evaluateInterventionPipeline({
    state: input.state,
    proactiveResult: input.proactiveResult,
    manifest,
    enforceBlock: mode === "enforce",
    tableTempoPhase: input.tableTempoPhase,
    lifecycle: input.lifecycle,
  });

  const traceId = input.traceId ?? createTurnTraceId();
  const interventionId = `${traceId}:ijs`;

  if (
    input.previousInterventionId &&
    input.previousDecision &&
    shouldRecordInterventionSuperseded({
      previousDecision: input.previousDecision,
      nextDecision: evaluation.decision,
    })
  ) {
    await projectInterventionSupersededToCommerce(admin, {
      aiSessionId: input.aiSessionId,
      tableSessionId: input.tableSessionId,
      traceId,
      payload: {
        type: "intervention.superseded",
        interventionId: input.previousInterventionId,
        manifestVersion: evaluation.manifestVersion,
        ruleId: evaluation.ruleId,
        reason: "ijs.new_tick",
        supersededByTraceId: traceId,
        source: input.source,
      },
    });
  }

  if (input.deferExpired && input.previousInterventionId) {
    await projectInterventionExpiredToCommerce(admin, {
      aiSessionId: input.aiSessionId,
      tableSessionId: input.tableSessionId,
      traceId,
      payload: {
        type: "intervention.expired",
        interventionId: input.previousInterventionId,
        manifestVersion: evaluation.manifestVersion,
        ruleId: evaluation.ruleId,
        reason: "ijs.defer_expired",
        evidenceSignature: evaluation.evidenceSignature,
        source: input.source,
      },
    });
  }

  const payload = buildInterventionJournalPayload({
    evaluation,
    interventionId,
    source: input.source,
  });

  await projectInterventionEvaluatedToCommerce(admin, {
    aiSessionId: input.aiSessionId,
    tableSessionId: input.tableSessionId,
    traceId,
    payload,
  });

  const declineReason =
    evaluation.decision === "defer"
      ? null
      : resolveInterventionDeclineReason(evaluation);

  if (declineReason) {
    await projectInterventionDeclinedToCommerce(admin, {
      aiSessionId: input.aiSessionId,
      tableSessionId: input.tableSessionId,
      traceId,
      payload: {
        type: "intervention.declined",
        interventionId,
        manifestVersion: evaluation.manifestVersion,
        ruleId: evaluation.ruleId,
        reason: declineReason,
        evidenceSignature: evaluation.evidenceSignature,
        updsKind: evaluation.updsKind,
        updsSkipReason: evaluation.updsSkipReason,
        source: input.source,
      },
    });
  }

  return { interventionId, traceId, evaluation };
}

/** Record successful IJS speak after proactive emit (ADR-041 P2). */
export async function recordInterventionCommitted(
  admin: SupabaseClient,
  input: {
    aiSessionId: string;
    tableSessionId: string;
    journal: InterventionJournalContext;
    source: string;
  }
): Promise<void> {
  await projectInterventionCommittedToCommerce(admin, {
    aiSessionId: input.aiSessionId,
    tableSessionId: input.tableSessionId,
    traceId: input.journal.traceId,
    payload: {
      type: "intervention.committed",
      interventionId: input.journal.interventionId,
      manifestVersion: input.journal.evaluation.manifestVersion,
      ruleId: input.journal.evaluation.ruleId,
      updsKind: input.journal.evaluation.updsKind,
      evidenceSignature: input.journal.evaluation.evidenceSignature,
      source: input.source,
    },
  });
}

export { evaluateInterventionPipeline };
