import type { DenisRiskClass } from "@/lib/denis/platform/risk-levels";

/** Browse telemetry action vocabulary (platform-owned — cognition re-exports). */
export type BrowseAction =
  | "view_category"
  | "view_product"
  | "close_product"
  | "add_to_cart"
  | "remove_from_cart"
  | "scroll_menu"
  | "nudge_interaction";

export type BrowseMenuSection = "food" | "drinks" | "desserts";

/** Browse telemetry embedded in timeline perception events (platform-owned shape). */
export type TimelineBrowseEvent = {
  action: BrowseAction;
  productId?: string;
  productName?: string;
  categoryId?: string;
  categoryPath?: string[];
  menuSection?: BrowseMenuSection | null;
  dwellMs?: number;
  timestamp: string;
};

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
  /** L3 guest understanding persisted at perceive time (LLM or router fallback). */
  interpretation?: import("@/lib/denis/cognition/tde/turn-interpretation-types").TurnInterpretation;
};

export type DenisTimelineEventPayload =
  | {
      type: "perception.ingested";
      frame: PerceptionFrame;
      envelope: TurnEnvelope;
      browseEvent?: TimelineBrowseEvent;
      /** Canonical L3 interpretation for downstream fold (active memory, mental model). */
      interpretation?: import("@/lib/denis/cognition/tde/turn-interpretation-types").TurnInterpretation;
      turnInterpretation?: import("@/lib/denis/cognition/tde/turn-interpretation-types").TurnInterpretation;
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
  | {
      type: "mental_model.updated";
      hash: string;
      computedAt?: number;
      confidence: number;
      model: Record<string, unknown>;
      triggers: string[];
    }
  | {
      type: "mental_model.gate";
      mode: string;
      candidateKind: string;
      allow: boolean;
      enforced: boolean;
      reason: string | null;
      wouldBlock: boolean;
      mentalHash: string;
      /** ADR-041 P3+ — IJS audit block on proactive gate rows. */
      ijs?: {
        manifestVersion: string;
        decision: string;
        ijsDecision: string;
        ruleId: string | null;
        shouldBlockSpeak: boolean;
        enforced: boolean;
      };
      /** ADR-042 VRP-P0 — rhythm prior audit block. */
      rhythm?: {
        mode: string;
        slotKey: string | null;
        confidence: number;
        applied: boolean;
        defaultDessertDelayMin: number;
        wouldOverrideDessertDelayMin: number | null;
        servicePeriod: string | null;
      };
    }
  | {
      type: "mental_model.diff";
      hash: string;
      significant: boolean;
      changes: Array<{ field: string; from: string; to: string }>;
      intentTransition: {
        from: string;
        to: string;
        at: number;
        durationMs: number;
      } | null;
      triggers: string[];
    }
  | {
      type: "offer.resolved";
      hash: string;
      computedAt: number;
      snapshot: {
        hash: string;
        readiness: {
          ready: boolean;
          reason: string;
          secondsSinceLastBrowseAction: number;
        };
        primaryProductId: string | null;
        alternativeProductId: string | null;
        strategy: string;
        sequencePattern: string;
      };
      triggers: string[];
    }
  | {
      type: "offer.converted";
      productId: string;
      productName: string | null;
      nudgeKind: string;
      offerResolution: string | null;
      emittedAt: string;
      convertedAt: string;
      lagSeconds: number;
      dedupeKey: string;
    }
  | {
      type: "anticipation.resolved";
      nudgeId: string;
      nudgeKind: string;
      outcome: "accepted" | "declined" | "ignored" | "expired";
      signal:
        | "add_to_cart"
        | "explicit_decline"
        | "dismiss"
        | "guest_message_unrelated"
        | "timeout";
      productId: string | null;
      productName: string | null;
      offerResolution: string | null;
      emittedAt: string;
      resolvedAt: string;
      lagMs: number | null;
    }
  | {
      type: "learning.menu_gap";
      term: string;
      guestMessage: string;
      locationId: string;
      capturedAt: string;
    }
  | {
      type: "learning.price_resistance";
      guestMessage: string;
      productHint?: string | null;
      locationId: string;
      capturedAt: string;
    }
  | {
      type: "learning.allergy_coverage";
      guestAllergens: string[];
      excludedFoodCount: number;
      locationId: string;
      capturedAt: string;
    }
  | {
      type: "learning.language_unsupported";
      detected: string;
      guestMessage: string;
      locationId: string;
      capturedAt: string;
    }
  | {
      type: "security.blocked";
      direction: "input" | "output";
      reason: string;
      layer: string;
      preview: string;
      blockCount: number;
      sessionFlagged: boolean;
      traceId?: string | null;
    }
  | {
      /** Guest Conduct Policy Engine MVP-1/3 — see resolve-guest-conduct-policy.ts. */
      type: "conduct.policy_decision";
      tier: "none" | "warn_1" | "warn_2" | "handoff";
      /** Final combined signal (regex OR LLM) that actually drove the tier. */
      offenseDetectedThisTurn: boolean;
      /** What abuse-protection.ts's regex alone would have found — diff against offenseDetectedThisTurn to see what the LLM step (MVP-3) adds. */
      regexOnlyOffenseDetected: boolean;
      /** null when the heuristic pre-filter skipped the LLM call, OpenAI is unconfigured, or the call/parse failed. */
      llmAssessment: {
        toneTowardDenis: "respectful" | "curt" | "mild_insult" | "severe_insult" | "threat";
        directedAt: "denis" | "service" | "unclear";
        confidence: number;
        quotedSpan: string;
      } | null;
      totalOffenseCount: number;
      haltSensitiveActions: boolean;
      notifyStaff: boolean;
      reason: string;
      /** true while the ladder is shadow-only — decision was logged, never shown to the guest. */
      shadowOnly: boolean;
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
  | "staff.proactive.alert"
  | "belief.revision"
  | "mind.fold_completed"
  | "mind.beliefs_compiled"
  | "mind.turn_profile"
  | "mental_model.updated"
  | "mental_model.gate"
  | "mental_model.diff"
  | "offer.resolved"
  | "offer.converted"
  | "anticipation.resolved"
  | "learning.menu_gap"
  | "learning.price_resistance"
  | "learning.allergy_coverage"
  | "learning.language_unsupported"
  | "security.blocked"
  | "conduct.policy_decision";

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
