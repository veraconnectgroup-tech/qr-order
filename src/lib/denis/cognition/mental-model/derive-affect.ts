import type {
  GuestAffect,
  GuestFrustrationLevel,
} from "@/lib/denis/cognition/mental-model/mental-model-types";
import type { GuestSignalSpine } from "@/lib/denis/cognition/mental-model/guest-signal-types";
import type { TurnInterpretation } from "@/lib/denis/cognition/tde/turn-interpretation-types";
import {
  isGuestComplaintMessage,
  isGuestStatusQueryMessage,
} from "@/lib/denis/cognition/tde/semantic-intent-router";

const CAPS_BURST_PATTERN = /(?:[A-ZČĆŠĐŽ]{4,}|\b[A-ZČĆŠĐŽ]{2,}(?:\s+[A-ZČĆŠĐŽ]{2,})+\b)/;
const PUNCTUATION_ESCALATION = /[!?]{2,}/;

function normalizeForRepeat(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function deriveFrustrationLevel(signals: string[]): GuestFrustrationLevel {
  if (signals.length === 0) return "none";

  const hasWaiting = signals.some((signal) => signal.startsWith("waiting:"));
  const hasCaps = signals.some((signal) => signal.startsWith("caps:"));
  const hasRepeat = signals.some((signal) => signal.startsWith("repeat:"));
  const hasPunctuation = signals.some((signal) => signal.startsWith("punctuation:"));

  if (hasRepeat || (hasWaiting && hasCaps) || signals.length >= 3) {
    return "high";
  }

  if (hasWaiting || hasCaps || hasPunctuation || signals.length >= 1) {
    return "mild";
  }

  return "none";
}

function clampSentiment(score: number): number {
  return Math.max(-1, Math.min(1, Math.round(score * 100) / 100));
}

function sentimentFromInterpretation(
  interpretation: TurnInterpretation | null | undefined
): number | null {
  if (!interpretation) return null;
  switch (interpretation.sentiment) {
    case "positive":
      return 0.75;
    case "frustrated":
      return -0.75;
    case "confused":
      return -0.25;
    default:
      return 0;
  }
}

/** Frustration + micro-sentiment from guest spine (ADR-038 Val C). */
export function deriveAffect(
  spine: GuestSignalSpine,
  interpretation?: TurnInterpretation | null
): GuestAffect {
  const frustrationSignals: string[] = [];
  const sentimentSignals: string[] = [];
  const repeatCounts = new Map<string, number>();

  for (const message of spine.guestMessages) {
    const text = message.text.trim();
    if (!text) continue;

    if (isGuestStatusQueryMessage(text) || isGuestComplaintMessage(text)) {
      frustrationSignals.push(`waiting:${text.slice(0, 40)}`);
    }
    if (CAPS_BURST_PATTERN.test(text)) {
      frustrationSignals.push(`caps:${text.slice(0, 40)}`);
    }
    if (PUNCTUATION_ESCALATION.test(text)) {
      frustrationSignals.push(`punctuation:${text.slice(0, 40)}`);
    }

    const normalized = normalizeForRepeat(text);
    const count = (repeatCounts.get(normalized) ?? 0) + 1;
    repeatCounts.set(normalized, count);
    if (count >= 2) {
      frustrationSignals.push(`repeat:${normalized.slice(0, 40)}`);
    }
  }

  const uniqueFrustrationSignals = [...new Set(frustrationSignals)].slice(-8);
  const uniqueSentimentSignals = [...new Set(sentimentSignals)].slice(-6);

  const interpretedScore = sentimentFromInterpretation(interpretation);
  let sentimentScore = interpretedScore ?? 0;

  if (interpretedScore == null && uniqueSentimentSignals.length > 0) {
    let sum = 0;
    for (const signal of uniqueSentimentSignals) {
      sum += signal.startsWith("positive:") ? 1 : -1;
    }
    sentimentScore = clampSentiment(sum / uniqueSentimentSignals.length);
  }

  const frustrationLevel = deriveFrustrationLevel(uniqueFrustrationSignals);
  if (
    frustrationLevel === "high" &&
    sentimentScore > -0.5 &&
    (interpretation?.sentiment === "frustrated" || interpretedScore == null)
  ) {
    sentimentScore = clampSentiment(Math.min(sentimentScore, -0.5));
  }

  if (interpretation?.sentiment === "frustrated" && frustrationLevel === "none") {
    return {
      frustration: { level: "mild", signals: ["interpretation:frustrated"] },
      sentiment: {
        score: clampSentiment(Math.min(sentimentScore, -0.5)),
        lastSignals: ["interpretation:frustrated"],
      },
    };
  }

  return {
    frustration: {
      level: frustrationLevel,
      signals: uniqueFrustrationSignals,
    },
    sentiment: {
      score: sentimentScore,
      lastSignals:
        interpretation?.sentiment && interpretation.sentiment !== "neutral"
          ? [`interpretation:${interpretation.sentiment}`]
          : uniqueSentimentSignals,
    },
  };
}
