import type {
  GuestEngagement,
  GuestIntent,
  GuestPace,
  GuestReadiness,
  GuestReadinessBand,
  GuestReceptiveness,
} from "@/lib/denis/cognition/mental-model/mental-model-types";

const INTENT_WEIGHT: Record<GuestIntent, number> = {
  arrived: 0.1,
  exploring: 0.35,
  comparing: 0.45,
  decided: 0.72,
  ordering: 0.88,
  waiting_food: 0.25,
  eating: 0.18,
  finishing: 0.55,
  paying: 0.92,
};

const RECEPTIVENESS_WEIGHT: Record<GuestReceptiveness, number> = {
  enthusiastic: 1,
  open: 0.82,
  neutral: 0.52,
  polite_decline: 0.22,
  closed: 0,
};

const PACE_WEIGHT: Record<GuestPace, number> = {
  rushed: 0.72,
  normal: 0.55,
  relaxed: 0.42,
  indecisive: 0.28,
};

function engagementScore(engagement: GuestEngagement): number {
  return Math.min(
    1,
    Math.min(engagement.guestTurns / 4, 0.5) +
      Math.min(engagement.avgMsgLen / 80, 0.25) +
      engagement.nudgeResponseRate * 0.25 +
      (engagement.guestInitiated ? 0.15 : 0)
  );
}

/** Composite 0–1 score — intent + engagement + pace + receptiveness (Prompt 92). */
export function deriveGuestReadiness(input: {
  intent: GuestIntent;
  engagement: GuestEngagement;
  pace: GuestPace;
  receptiveness: GuestReceptiveness;
  cartLineCount: number;
}): GuestReadiness {
  let score =
    (INTENT_WEIGHT[input.intent] ?? 0.3) * 0.38 +
    (RECEPTIVENESS_WEIGHT[input.receptiveness] ?? 0.5) * 0.28 +
    engagementScore(input.engagement) * 0.2 +
    (PACE_WEIGHT[input.pace] ?? 0.5) * 0.14;

  if (input.cartLineCount > 0) {
    score = Math.min(1, score + 0.12);
  }
  if (input.intent === "ordering" || input.intent === "decided") {
    score = Math.min(1, score + 0.05);
  }

  score = Math.round(Math.min(1, Math.max(0, score)) * 100) / 100;

  const band: GuestReadinessBand =
    score >= 0.8 ? "high" : score >= 0.4 ? "medium" : "low";

  const offerSubmit =
    score >= 0.8 &&
    (input.intent === "decided" ||
      input.intent === "ordering" ||
      input.cartLineCount > 0);

  return { score, band, offerSubmit };
}
