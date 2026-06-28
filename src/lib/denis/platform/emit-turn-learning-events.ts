import { appendDenisTimelineEvent } from "@/lib/denis/platform/append-timeline-event";
import {
  detectTurnLearningSignals,
  type DetectTurnLearningSignalsInput,
  type TurnLearningSignal,
} from "@/lib/denis/platform/detect-turn-learning-signals";
import type { DenisTimelineEventType } from "@/lib/denis/platform/timeline-types";
import type { SupabaseClient } from "@supabase/supabase-js";

function eventTypeForSignal(signal: TurnLearningSignal): DenisTimelineEventType {
  switch (signal.kind) {
    case "menu_gap":
      return "learning.menu_gap";
    case "price_resistance":
      return "learning.price_resistance";
    case "allergy_coverage":
      return "learning.allergy_coverage";
    case "language_unsupported":
      return "learning.language_unsupported";
  }
}

function payloadForSignal(
  signal: TurnLearningSignal,
  input: { locationId: string; capturedAt: string }
): Record<string, unknown> {
  switch (signal.kind) {
    case "menu_gap":
      return {
        type: "learning.menu_gap",
        term: signal.term,
        guestMessage: signal.guestMessage,
        locationId: input.locationId,
        capturedAt: input.capturedAt,
      };
    case "price_resistance":
      return {
        type: "learning.price_resistance",
        guestMessage: signal.guestMessage,
        productHint: signal.productHint,
        locationId: input.locationId,
        capturedAt: input.capturedAt,
      };
    case "allergy_coverage":
      return {
        type: "learning.allergy_coverage",
        guestAllergens: signal.guestAllergens,
        excludedFoodCount: signal.excludedFoodCount,
        locationId: input.locationId,
        capturedAt: input.capturedAt,
      };
    case "language_unsupported":
      return {
        type: "learning.language_unsupported",
        detected: signal.detected,
        guestMessage: signal.guestMessage,
        locationId: input.locationId,
        capturedAt: input.capturedAt,
      };
  }
}

export async function emitTurnLearningEvents(
  admin: SupabaseClient,
  input: {
    aiSessionId: string;
    traceId: string;
    locationId: string;
    detectInput: DetectTurnLearningSignalsInput;
    signals?: TurnLearningSignal[];
  }
): Promise<TurnLearningSignal[]> {
  const signals =
    input.signals ?? detectTurnLearningSignals(input.detectInput);
  if (signals.length === 0) return [];

  const capturedAt = new Date().toISOString();

  for (const signal of signals) {
    await appendDenisTimelineEvent(admin, {
      aiSessionId: input.aiSessionId,
      eventType: eventTypeForSignal(signal),
      traceId: input.traceId,
      payload: payloadForSignal(signal, {
        locationId: input.locationId,
        capturedAt,
      }),
    });
  }

  return signals;
}
