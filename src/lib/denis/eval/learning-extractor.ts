import {
  extractConversationMessages,
  textSimilarity,
  type ConversationMessage,
} from "@/lib/denis/monitoring/loop-detection";
import { collectTurnInterpretationsFromTimeline } from "@/lib/denis/cognition/tde/extract-turn-interpretation";
import {
  classifyGuestIntent,
  isGuestHandoffMessage,
  isGuestOrderIntentMessage,
  isGuestPriceInquiryMessage,
} from "@/lib/denis/cognition/tde/semantic-intent-router";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

export type SessionLearningKind =
  | "mismatch"
  | "correction"
  | "waiter_failure"
  | "reinforcement";

export type ExtractedLearning = {
  id: string;
  kind: SessionLearningKind;
  guestMessage: string;
  denisResponse?: string;
  correctedTo?: string;
  sessionId: string;
  locationId?: string;
  capturedAt: string;
  confidence: number;
};

export type SessionEvalMetrics = {
  turnCount: number;
  upsellOffered: boolean;
  upsellAccepted: boolean;
  handoffAfterDenis: boolean;
  ordersCount: number;
};

function learningId(sessionId: string, kind: SessionLearningKind, index: number): string {
  return `${sessionId}:${kind}:${index}`;
}

function guestIntentFromTimeline(
  timeline: DenisTimelineRow[],
  afterAt: string
): string | null {
  for (const event of timeline) {
    if (event.created_at <= afterAt) continue;
    if (event.event_type !== "intent.resolved") continue;
    const payload = event.payload as { intent?: string } | null;
    if (payload?.intent) return payload.intent;
  }
  return null;
}

function interpretationForGuestText(
  timeline: DenisTimelineRow[],
  guestText: string,
  at: string
): ReturnType<typeof collectTurnInterpretationsFromTimeline>[number]["interpretation"] | null {
  const interpretations = collectTurnInterpretationsFromTimeline(timeline);
  const match = interpretations.find(
    (row) => row.guestText === guestText || row.atMs >= Date.parse(at)
  );
  return match?.interpretation ?? null;
}

function denisMentionedGuestTopic(guestText: string, denisText: string): boolean {
  const guestTokens = guestText
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((part) => part.length >= 4);

  if (guestTokens.length === 0) return true;

  const denisNorm = denisText.toLowerCase();
  const overlap = guestTokens.filter((token) => denisNorm.includes(token)).length;
  return overlap / guestTokens.length >= 0.34 || textSimilarity(guestText, denisText) >= 0.45;
}

function extractCorrectedTo(
  guestText: string,
  interpretation: ReturnType<typeof interpretationForGuestText>
): string | null {
  if (interpretation?.agreedOrderLine?.trim()) {
    return interpretation.agreedOrderLine.trim();
  }
  const trimmed = guestText.trim();
  const afterComma = trimmed.split(/[,—–-]\s+/).slice(1).join(" ").trim();
  if (afterComma.length >= 3) return afterComma;
  return null;
}

function isGuestCorrectionMessage(
  guestText: string,
  interpretation: ReturnType<typeof interpretationForGuestText>
): boolean {
  if (interpretation?.sentiment === "confused") return true;
  if ((interpretation?.modifications?.length ?? 0) > 0) return true;
  const route = classifyGuestIntent(guestText);
  if (route.intent === "decline" && guestText.trim().length > 4) return true;
  if (route.intent === "modification") return true;
  const corrected = extractCorrectedTo(guestText, interpretation);
  return Boolean(corrected && guestTextStartsWithNe(guestText));
}

function guestTextStartsWithNe(guestText: string): boolean {
  return guestText
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .startsWith("ne");
}

function isGuestReinforcementMessage(
  guestText: string,
  interpretation: ReturnType<typeof interpretationForGuestText>
): boolean {
  if (interpretation?.sentiment === "positive") return true;
  const route = classifyGuestIntent(guestText);
  return route.intent === "confirm";
}

function isGuestMismatchCandidate(guestText: string): boolean {
  const route = classifyGuestIntent(guestText);
  return (
    isGuestOrderIntentMessage(guestText) ||
    isGuestPriceInquiryMessage(guestText) ||
    route.intent === "browse" ||
    route.intent === "modification"
  );
}

/** Pure extraction of session learnings from transcript + timeline. */
export function extractSessionLearnings(input: {
  sessionId: string;
  locationId?: string;
  messages?: ConversationMessage[];
  timeline?: DenisTimelineRow[];
  capturedAt?: string;
}): ExtractedLearning[] {
  const messages =
    input.messages ??
    (input.timeline ? extractConversationMessages(input.timeline) : []);
  const timeline = input.timeline ?? [];
  const capturedAt = input.capturedAt ?? new Date().toISOString();
  const learnings: ExtractedLearning[] = [];

  for (let index = 0; index < messages.length; index += 1) {
    const turn = messages[index];
    if (turn.role !== "guest") continue;

    const interpretation = interpretationForGuestText(timeline, turn.text, turn.at);
    const nextDenis = messages[index + 1];
    if (
      nextDenis?.role === "denis" &&
      isGuestMismatchCandidate(turn.text) &&
      !denisMentionedGuestTopic(turn.text, nextDenis.text)
    ) {
      const duplicate = learnings.some(
        (row) =>
          row.kind === "mismatch" &&
          row.guestMessage === turn.text &&
          row.denisResponse === nextDenis.text
      );
      if (!duplicate) {
        learnings.push({
          id: learningId(input.sessionId, "mismatch", learnings.length),
          kind: "mismatch",
          guestMessage: turn.text,
          denisResponse: nextDenis.text,
          sessionId: input.sessionId,
          locationId: input.locationId,
          capturedAt: turn.at,
          confidence: 0.84,
        });
      }
    }

    const priorDenis = [...messages.slice(0, index)]
      .reverse()
      .find((row) => row.role === "denis");

    if (priorDenis && isGuestCorrectionMessage(turn.text, interpretation)) {
      learnings.push({
        id: learningId(input.sessionId, "correction", learnings.length),
        kind: "correction",
        guestMessage: turn.text,
        denisResponse: priorDenis.text,
        correctedTo: extractCorrectedTo(turn.text, interpretation) ?? undefined,
        sessionId: input.sessionId,
        locationId: input.locationId,
        capturedAt,
        confidence: 0.92,
      });
      continue;
    }

    if (priorDenis && isGuestHandoffMessage(turn.text)) {
      learnings.push({
        id: learningId(input.sessionId, "waiter_failure", learnings.length),
        kind: "waiter_failure",
        guestMessage: turn.text,
        denisResponse: priorDenis.text,
        sessionId: input.sessionId,
        locationId: input.locationId,
        capturedAt,
        confidence: 0.88,
      });
      continue;
    }

    if (
      priorDenis &&
      isGuestOrderIntentMessage(turn.text) &&
      !denisMentionedGuestTopic(turn.text, priorDenis.text)
    ) {
      learnings.push({
        id: learningId(input.sessionId, "mismatch", learnings.length),
        kind: "mismatch",
        guestMessage: turn.text,
        denisResponse: priorDenis.text,
        sessionId: input.sessionId,
        locationId: input.locationId,
        capturedAt,
        confidence: 0.8,
      });
      continue;
    }

    if (priorDenis && isGuestReinforcementMessage(turn.text, interpretation)) {
      learnings.push({
        id: learningId(input.sessionId, "reinforcement", learnings.length),
        kind: "reinforcement",
        guestMessage: turn.text,
        denisResponse: priorDenis.text,
        sessionId: input.sessionId,
        locationId: input.locationId,
        capturedAt,
        confidence: 0.75,
      });
    }
  }

  for (const event of timeline) {
    if (event.event_type !== "intent.resolved") continue;
    const payload = event.payload as { intent?: string } | null;
    if (payload?.intent !== "HANDOFF_WAITER") continue;

    const priorGuest = [...messages]
      .reverse()
      .find((row) => row.role === "guest" && row.at <= event.created_at);
    const priorDenis = [...messages]
      .reverse()
      .find((row) => row.role === "denis" && row.at <= event.created_at);

    if (!priorDenis) continue;

    const duplicate = learnings.some(
      (row) =>
        row.kind === "waiter_failure" &&
        row.denisResponse === priorDenis.text
    );
    if (duplicate) continue;

    learnings.push({
      id: learningId(input.sessionId, "waiter_failure", learnings.length),
      kind: "waiter_failure",
      guestMessage: priorGuest?.text ?? "HANDOFF_WAITER",
      denisResponse: priorDenis.text,
      sessionId: input.sessionId,
      locationId: input.locationId,
      capturedAt: event.created_at,
      confidence: 0.9,
    });
  }

  if (timeline.length > 0) {
    for (let index = 0; index < messages.length; index += 1) {
      const guest = messages[index];
      if (guest.role !== "guest" || !isGuestMismatchCandidate(guest.text)) {
        continue;
      }

      const denis = messages[index + 1];
      if (!denis || denis.role !== "denis") continue;

      const intent = guestIntentFromTimeline(timeline, guest.at);
      if (intent !== "UNKNOWN" && intent !== "BROWSE") continue;
      if (denisMentionedGuestTopic(guest.text, denis.text)) continue;

      const duplicate = learnings.some(
        (row) =>
          row.kind === "mismatch" &&
          row.guestMessage === guest.text &&
          row.denisResponse === denis.text
      );
      if (duplicate) continue;

      learnings.push({
        id: learningId(input.sessionId, "mismatch", learnings.length),
        kind: "mismatch",
        guestMessage: guest.text,
        denisResponse: denis.text,
        sessionId: input.sessionId,
        locationId: input.locationId,
        capturedAt: guest.at,
        confidence: 0.78,
      });
    }
  }

  return learnings;
}
