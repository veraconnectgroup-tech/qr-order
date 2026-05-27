import type { DenisRiskClass } from "@/lib/denis/platform/risk-levels";

/** Envelope attached to timeline events (ADR-006 §5). */
export type TurnEnvelope = {
  traceId: string;
  surface: "chat" | "nudge" | "sense" | "staff" | "system";
  rolloutMode?: string;
  configVersion?: number;
  latencyMs?: Partial<{
    perceive: number;
    plan: number;
    act: number;
    narrate: number;
  }>;
  tokenUsage?: {
    prompt: number;
    completion: number;
    model: string;
  };
};

export type GuestIntent =
  | "ORDER"
  | "CLARIFY_REPLY"
  | "CONFIRM"
  | "DECLINE"
  | "DONE"
  | "BROWSE"
  | "STATUS"
  | "HANDOFF_WAITER"
  | "HANDOFF_PAY"
  | "SMALLTALK"
  | "UNKNOWN";

export type PerceptionChannel =
  | "chat.message"
  | "ui.quick_reply"
  | "ui.conversion"
  | "telemetry.scroll"
  | "telemetry.manual_cart"
  | "realtime.order_status"
  | "system.proactive_tick"
  | "staff.message";

export type PerceptionFrame = {
  channel: PerceptionChannel;
  normalizedText: string | null;
  structuredIntent: GuestIntent | null;
  ingestedAt: string;
};

export type DenisTimelineEventPayload =
  | { type: "perception.ingested"; frame: PerceptionFrame; envelope: TurnEnvelope }
  | {
      type: "intent.resolved";
      intent: GuestIntent;
      tier: "T0" | "T2";
      envelope?: TurnEnvelope;
    }
  | {
      type: "plan.created";
      actions: Array<{ skillId: string; riskClass: DenisRiskClass }>;
      envelope?: TurnEnvelope;
    }
  | { type: "policy.blocked"; ruleId: string; riskClass: DenisRiskClass }
  | { type: "draft.changed"; cartRevision: number }
  | { type: "order.command.ack"; orderId: string }
  | { type: "narration.sent"; message: string; tier: "template" | "T3" }
  | { type: "realtime.ingested"; source: string; payload: unknown }
  | { type: "belief.revision"; keys: string[] }
  | Record<string, unknown>;

export type DenisTimelineEventType =
  | "perception.ingested"
  | "intent.resolved"
  | "plan.created"
  | "policy.blocked"
  | "skill.executed"
  | "draft.changed"
  | "flow.transitioned"
  | "order.command.sent"
  | "order.command.ack"
  | "narration.sent"
  | "realtime.ingested"
  | "proactive.emitted"
  | "belief.revision";

export type DenisTimelineRow = {
  id: string;
  ai_session_id: string;
  seq: number;
  event_type: DenisTimelineEventType | string;
  payload: DenisTimelineEventPayload;
  trace_id: string | null;
  context_hash: string | null;
  created_at: string;
};

export type AppendTimelineEventInput = {
  aiSessionId: string;
  eventType: DenisTimelineEventType | string;
  payload: DenisTimelineEventPayload | Record<string, unknown>;
  traceId?: string | null;
  contextHash?: string | null;
};

export function createTurnTraceId(): string {
  return crypto.randomUUID();
}

export function buildTurnEnvelope(
  surface: TurnEnvelope["surface"],
  traceId: string = createTurnTraceId()
): TurnEnvelope {
  return {
    traceId,
    surface,
    configVersion: 1,
  };
}
