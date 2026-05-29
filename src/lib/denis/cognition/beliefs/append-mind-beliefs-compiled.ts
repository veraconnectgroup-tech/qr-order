import { appendDenisTimelineEvent } from "@/lib/denis/platform/append-timeline-event";
import {
  computeBeliefsHash,
  summarizeBeliefGraph,
} from "@/lib/denis/cognition/beliefs/compute-beliefs-hash";
import type { BeliefGraph } from "@/lib/denis/cognition/beliefs/belief-types";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function appendMindBeliefsCompiled(
  admin: SupabaseClient,
  input: {
    aiSessionId: string;
    traceId: string;
    graph: BeliefGraph;
    truthHash?: string | null;
  }
): Promise<void> {
  const beliefsHash = computeBeliefsHash(input.graph);
  const summary = summarizeBeliefGraph(input.graph);

  await appendDenisTimelineEvent(admin, {
    aiSessionId: input.aiSessionId,
    eventType: "mind.beliefs_compiled",
    traceId: input.traceId,
    contextHash: input.truthHash ?? beliefsHash,
    payload: {
      type: "mind.beliefs_compiled",
      beliefsHash,
      beliefCount: input.graph.beliefs.length,
      summary,
    },
  });
}
