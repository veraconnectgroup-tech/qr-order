import type { RecoveryAction } from "@/lib/denis/cognition/recovery/frustration-recovery";
import {
  deriveOrderLifecycleBeliefs,
  planFrustrationRecovery,
  resolveFrustrationStaffEscalation,
} from "@/lib/denis/cognition/recovery/frustration-recovery";
import {
  detectServiceRecoveryTrigger,
  type ServiceRecoveryTriggerResult,
} from "@/lib/denis/cognition/recovery/detect-service-recovery";
import type { DenisTurnContext } from "@/lib/denis/runtime/turn-types";
import { emptyGuestMentalModel } from "@/lib/denis/cognition/mental-model/empty-mental-model";

function oldestOpenOrderAgeMinutes(
  orders: Array<{ createdAt: string; status: string }>,
  nowMs: number
): number | null {
  const open = orders.filter(
    (order) =>
      order.status !== "delivered" &&
      order.status !== "cancelled" &&
      order.status !== "rejected"
  );
  if (!open.length) return null;
  const oldest = Math.min(
    ...open
      .map((order) => Date.parse(order.createdAt))
      .filter(Number.isFinite)
  );
  if (!Number.isFinite(oldest)) return null;
  return (nowMs - oldest) / 60_000;
}

function lastGuestTimelineAtMs(
  timeline: Array<{ created_at: string; event_type: string }>
): number | null {
  for (let index = timeline.length - 1; index >= 0; index -= 1) {
    const row = timeline[index]!;
    if (
      row.event_type === "signal.message" ||
      row.event_type === "perception.ingested"
    ) {
      const at = Date.parse(row.created_at);
      if (Number.isFinite(at)) return at;
    }
  }
  return null;
}

export function resolveRecoveryActionsForTurn(input: {
  ctx: DenisTurnContext;
  language: string;
  guestMessage: string;
  nowMs?: number;
}): {
  actions: RecoveryAction[];
  serviceRecovery: ServiceRecoveryTriggerResult | null;
} {
  const nowMs = input.nowMs ?? Date.now();
  const mental = input.ctx.tableSessionState?.mental;
  const orders = input.ctx.tableSessionState?.commerce.orders ?? [];
  const timeline = input.ctx.tableSessionState?.timeline ?? [];

  const hasOpenKitchenOrders = orders.some(
    (order) =>
      order.status !== "delivered" &&
      order.status !== "cancelled" &&
      ["pending", "confirmed", "preparing", "ready"].includes(order.status)
  );

  const staffCount = input.ctx.venueOps?.staffOnFloor;
  const staffOnFloor = staffCount == null ? true : staffCount > 0;

  const orderLifecycle = deriveOrderLifecycleBeliefs({
    sessionPhase: input.ctx.foldMeta?.phase ?? null,
    hasOpenKitchenOrders,
    hasAnyOrders: orders.length > 0,
  });

  const actions = planFrustrationRecovery({
    affect: mental?.affect ?? emptyGuestMentalModel().affect,
    orderLifecycle,
    staffOnFloor,
    language: input.language,
  });

  const serviceRecovery = detectServiceRecoveryTrigger({
    guestMessage: input.guestMessage,
    affect: mental?.affect ?? null,
    orderLifecycle,
    config: input.ctx.config.ops.serviceRecovery,
    lastGuestMessageAtMs: lastGuestTimelineAtMs(timeline),
    nowMs,
    oldestOpenOrderAgeMinutes: oldestOpenOrderAgeMinutes(orders, nowMs),
  });

  if (
    serviceRecovery.shouldEscalate &&
    input.ctx.config.ops.serviceRecovery.enabled
  ) {
    const existing = resolveFrustrationStaffEscalation(actions);
    if (existing) {
      existing.urgency = "urgent";
      existing.reason = serviceRecovery.triggers.join("+");
    } else {
      actions.push({
        kind: "staff_escalation",
        urgency: "urgent",
        reason: serviceRecovery.triggers.join("+"),
      });
    }
  }

  return {
    actions,
    serviceRecovery: serviceRecovery.shouldEscalate ? serviceRecovery : null,
  };
}
