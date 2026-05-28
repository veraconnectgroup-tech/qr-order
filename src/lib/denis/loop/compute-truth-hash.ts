import { createHash } from "node:crypto";
import type { FoldMeta, TableSessionState } from "@/lib/denis/loop/types";

function stableSerialize(value: unknown): string {
  return JSON.stringify(value, (_key, v) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return Object.keys(v as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = (v as Record<string, unknown>)[key];
          return acc;
        }, {});
    }
    return v;
  });
}

/** Hash key FOLD inputs for idempotency (ADR-019 Phase A). */
export function computeTruthHash(state: TableSessionState): string {
  const payload = {
    sessionId: state.session.id,
    orderIds: state.commerce.orders.map((order) => order.id).sort(),
    aiCartRevision: state.commerce.cart.ai.draft.cartRevision,
    manualCartRevision: state.commerce.cart.manual?.cartRevision ?? 0,
    peerManualCount: state.commerce.cart.peerManual?.items.length ?? 0,
    flowNodeId: state.conversation.flowNodeId,
    timelineSeq:
      state.timeline.length > 0
        ? state.timeline[state.timeline.length - 1]?.seq ?? 0
        : 0,
    opsMode: state.venue.ops.operatingMode,
    kdsStress: state.venue.ops.kdsStress,
  };

  return createHash("sha256").update(stableSerialize(payload)).digest("hex");
}

export function buildFoldMeta(
  state: TableSessionState,
  tableSessionId: string | null,
  draftAiSessionId: string | null,
  phase: FoldMeta["phase"]
): FoldMeta {
  return {
    truthHash: computeTruthHash(state),
    orderCount: state.commerce.orders.length,
    phase,
    tableSessionId,
    draftAiSessionId,
  };
}
