import { buildSessionWatcherContext } from "@/lib/denis/cognition/proactive/session-watcher-context";
import { orchestrateTableLifecycle } from "@/lib/denis/cognition/lifecycle/orchestrate-table-lifecycle";
import type { TableLifecycleOrchestration } from "@/lib/denis/cognition/lifecycle/table-lifecycle-types";
import {
  detectPredictiveRecoveryFromTimeline,
  type PredictiveRecoveryResult,
} from "@/lib/denis/cognition/recovery/detect-predictive-recovery";
import {
  detectTableTempoPhase,
  type TableTempoPhase,
} from "@/lib/denis/cognition/tempo/detect-table-tempo-phase";
import type { TableSessionState } from "@/lib/denis/loop/types";
import type { EventConfig } from "@/lib/denis/venue/ops/event-mode";

export type TableLifecycleContext = {
  tableTempoPhase: TableTempoPhase;
  lifecycle: TableLifecycleOrchestration;
  predictiveRecovery: PredictiveRecoveryResult;
};

type ResolveTableLifecycleInput = {
  state: Pick<TableSessionState, "mental" | "commerce" | "config" | "timeline">;
  sessionOpenedAt?: string | null;
  idleMinutes?: number;
  guestMessageCount?: number;
  predictiveRecovery?: PredictiveRecoveryResult | null;
  nowMs?: number;
  eventConfig?: EventConfig | null;
};

/** One resolver — tempo + scroll + sommelier → lifecycle lane (QR → bill). */
export function resolveTableLifecycleContext(
  input: ResolveTableLifecycleInput
): TableLifecycleContext {
  const nowMs = input.nowMs ?? Date.now();
  const predictiveRecovery =
    input.predictiveRecovery ??
    detectPredictiveRecoveryFromTimeline({
      orders: input.state.commerce.orders,
      timeline: input.state.timeline,
      orderDelayMinutes: input.state.config.proactive.orderDelayMinutes,
      nowMs,
    });

  let idleMinutes = input.idleMinutes;
  let guestMessageCount = input.guestMessageCount;

  if (
    input.sessionOpenedAt &&
    (idleMinutes === undefined || guestMessageCount === undefined)
  ) {
    const watcher = buildSessionWatcherContext({
      timeline: input.state.timeline,
      orders: [],
      sessionOpenedAt: input.sessionOpenedAt,
      now: nowMs,
    });
    idleMinutes ??= watcher.idleMinutes;
    guestMessageCount ??= watcher.guestMessageCount;
  }

  const tableTempoPhase =
    input.state.config.ops.tableTempo.enabled && input.sessionOpenedAt
      ? detectTableTempoPhase({
          sessionOpenedAt: input.sessionOpenedAt,
          orders: input.state.commerce.orders,
          guestMessageCount: guestMessageCount ?? 0,
          idleMinutes: idleMinutes ?? 0,
          config: input.state.config.ops.tableTempo,
          nowMs,
        })
      : "none";

  const lifecycle = orchestrateTableLifecycle({
    mental: input.state.mental,
    tableTempoPhase,
    orders: input.state.commerce.orders,
    cartLineCount: input.state.commerce.cart.visibleLines.length,
    predictiveRecovery,
  });

  return { tableTempoPhase, lifecycle, predictiveRecovery };
}
