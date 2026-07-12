import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConciergeStationQuestions } from "@/lib/denis/config/concierge-config.schema";
import {
  createStationQuestion,
  type StationQuestionRow,
} from "@/lib/denis/stations/station-questions";

/**
 * Founder's own framing for this feature: Denis is activated once per
 * shift and "then that's it" — station voice's `primed` state
 * (use-denis-station-voice.ts) already stays true for the rest of that
 * tab's session once a staff member taps Activate, so any question that
 * appears afterward (including one Denis opens himself) gets spoken
 * automatically, no new call/autoplay infrastructure needed. This module
 * is the other half: deciding WHEN Denis should open a new question at
 * the bar because the kitchen isn't answering.
 *
 * One hop only, by construction rather than a tracked depth counter: this
 * only ever fires for an expiring "kitchen" question, and it only ever
 * creates a "bar" question — a bar-station expiry (escalation or not)
 * never re-enters this function, so kitchen→bar→kitchen ping-pong simply
 * isn't reachable. If the bar also doesn't answer, expireStationQuestions'
 * existing manager-notification fallback is still the final backstop,
 * unchanged.
 */
const ESCALATION_SOURCE_PREFIX = "escalation_from:";

export function isEscalationQuestion(
  question: Pick<StationQuestionRow, "source_event">
): boolean {
  return (question.source_event ?? "").startsWith(ESCALATION_SOURCE_PREFIX);
}

export type EscalateKitchenQuestionResult =
  | { escalated: true }
  | {
      escalated: false;
      reason:
        | "disabled"
        | "not_kitchen"
        | "already_escalation"
        | "no_order"
        | "create_failed";
      createReason?: string;
    };

export async function escalateKitchenQuestionToBar(
  admin: SupabaseClient,
  question: StationQuestionRow,
  config: ConciergeStationQuestions
): Promise<EscalateKitchenQuestionResult> {
  if (!config.escalateToBarEnabled) {
    return { escalated: false, reason: "disabled" };
  }
  if (question.station !== "kitchen") {
    return { escalated: false, reason: "not_kitchen" };
  }
  if (isEscalationQuestion(question)) {
    return { escalated: false, reason: "already_escalation" };
  }
  if (!question.order_id) {
    return { escalated: false, reason: "no_order" };
  }

  const result = await createStationQuestion(admin, {
    locationId: question.location_id,
    orderId: question.order_id,
    tableId: question.table_id,
    station: "bar",
    questionType: question.question_type,
    message: `Kuhinja ne odgovara — možeš da pomogneš? ${question.message}`,
    askedBy: "denis",
    sourceEvent: `${ESCALATION_SOURCE_PREFIX}${question.id}`,
    config,
  });

  if (!result.created) {
    return { escalated: false, reason: "create_failed", createReason: result.reason };
  }
  return { escalated: true };
}
