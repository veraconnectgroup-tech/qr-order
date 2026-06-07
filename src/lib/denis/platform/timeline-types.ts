import type { BrowseEvent } from "@/lib/denis/cognition/browse/browse-types";
import type { DenisRiskClass } from "@/lib/denis/platform/risk-levels";

/** Envelope attached to timeline events (ADR-006 §5). */
export type TurnEnvelope = {
  traceId: string;
  surface: "chat" | "nudge" | "sense" | "staff" | "system" | "voice";
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
  | "ORDER_CANCEL"
  | "ORDER_MODIFY"
  | "SMALLTALK"
  | "UNKNOWN";

export type PerceptionChannel =
  | "chat.message"
  | "ui.quick_reply"
  | "ui.conversion"
  | "telemetry.scroll"
  | "telemetry.browse"
  | "telemetry.manual_cart"
  | "realtime.order_status"
  | "system.proactive_tick"
  | "staff.message"
  | "voice.transcript"
  | "voice.tts";

export type PerceptionFrame = {
  channel: PerceptionChannel;
  normalizedText: string | null;
  structuredIntent: GuestIntent | null;
  ingestedAt: string;
};

export type DenisTimelineEventPayload =
  | {
      type: "perception.ingested";
      frame: PerceptionFrame;
      envelope: TurnEnvelope;
      browseEvent?: BrowseEvent;
    }
  | {
      type: "intent.resolved";
      intent: GuestIntent;
      tier: "T0" | "T2";
      envelope?: TurnEnvelope;
      evidence?: unknown;
    }
  | {
      type: "plan.created";
      actions: Array<{ skillId: string; riskClass: DenisRiskClass }>;
      envelope?: TurnEnvelope;
      topGoal?: string | null;
    }
  | { type: "policy.blocked"; ruleId: string; riskClass: DenisRiskClass }
  | { type: "draft.changed"; cartRevision: number; diff?: unknown; guestMessage?: string }
  | { type: "order.command.ack"; orderId: string }
  | { type: "narration.sent"; message: string; tier: "legacy" | "template" | "T3"; linted?: boolean; source?: string }
  | { type: "signal.message"; text: string; channel?: PerceptionChannel; intent?: GuestIntent | null; envelope?: TurnEnvelope }
  | { type: "tell.committed"; message: string; tier?: "legacy" | "template" | "T3"; source?: string; linted?: boolean }
  | { type: "realtime.ingested"; source: string; payload: unknown; envelope?: TurnEnvelope }
  | { type: "belief.revision"; keys: string[]; conflicts?: unknown; strategy?: string | null; guestPrompt?: string | null; channel?: string }
  | {
      type: "mind.beliefs_compiled";
      beliefsHash: string;
      beliefCount: number;
      summary: Record<string, unknown>;
    }
  | {
      type: "mind.turn_profile";
      tier: string;
      planKind: string;
      planReason: string;
      llmUsed: boolean;
      beliefsHash?: string;
      evidencePointers?: string[];
      pendingSlotActResolved?: boolean;
    }
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
  | "signal.message"
  | "tell.committed"
  | "realtime.ingested"
  | "proactive.emitted"
  | "belief.revision"
  | "mind.fold_completed"
  | "mind.beliefs_compiled"
  | "mind.turn_profile";

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
