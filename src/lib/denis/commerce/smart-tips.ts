import {
  EXPERIENCE_HIGH_THRESHOLD,
  EXPERIENCE_LOW_THRESHOLD,
  type FeedbackSentiment,
} from "@/lib/commerce/experience/resolve-experience-moment";
import type { GuestFrustrationLevel } from "@/lib/denis/cognition/mental-model/mental-model-types";

export type TipMarketRegion = "de" | "us" | "balkan";

export type TipSplitMode = "pool" | "per_waiter";

export type TipSuggestion = {
  presets: number[];
  defaultIndex: number;
  defaultPercent: number;
  personalMessage: string | null;
  denisMessage: string | null;
  sentiment: "positive" | "neutral" | "negative";
  showProminent: boolean;
  titleKey: string;
  allowSkip: boolean;
  experienceScore: number | null;
  marketRegion: TipMarketRegion;
};

export type TipSuggestionInput = {
  orderTotal: number;
  feedbackRating: number | null;
  feedbackSentiment?: FeedbackSentiment | null;
  frustrationLevel: GuestFrustrationLevel;
  waitTimeMinutes: number;
  isReturningGuest: boolean;
  venueAvgTipPercent: number;
  experienceScore?: number | null;
  waiterName?: string | null;
  language?: string;
  marketRegion?: TipMarketRegion;
};

function inferRating(input: {
  feedbackRating: number | null;
  feedbackSentiment?: FeedbackSentiment | null;
}): number | null {
  if (
    input.feedbackRating != null &&
    input.feedbackRating >= 1 &&
    input.feedbackRating <= 5
  ) {
    return input.feedbackRating;
  }
  if (input.feedbackSentiment === "positive") return 5;
  if (input.feedbackSentiment === "neutral") return 3;
  if (input.feedbackSentiment === "negative") return 2;
  return null;
}

function resolveSentiment(
  rating: number | null,
  frustrationLevel: GuestFrustrationLevel
): TipSuggestion["sentiment"] {
  if (frustrationLevel === "high") return "negative";
  if (rating == null) return "neutral";
  if (rating >= 4) return "positive";
  if (rating === 3) return "neutral";
  return "negative";
}

/** Map guest language / explicit venue market to tipping culture. */
export function resolveTipMarketRegion(input: {
  language?: string;
  marketRegion?: TipMarketRegion;
}): TipMarketRegion {
  if (input.marketRegion) return input.marketRegion;
  const lang = (input.language ?? "sr").toLowerCase().slice(0, 2);
  if (lang === "de") return "de";
  if (lang === "en") return "us";
  return "balkan";
}

export function resolveTipSplitMode(
  params: Record<string, unknown> | undefined
): TipSplitMode {
  return params?.tipSplitMode === "pool" ? "pool" : "per_waiter";
}

type ScoreBandPresets = {
  presets: number[];
  defaultIndex: number;
  defaultPercent: number;
  showProminent: boolean;
};

function resolveScoreBandPresets(
  score: number,
  region: TipMarketRegion
): ScoreBandPresets {
  if (score > EXPERIENCE_HIGH_THRESHOLD) {
    if (region === "us") {
      return {
        presets: [15, 20, 25],
        defaultIndex: 1,
        defaultPercent: 20,
        showProminent: true,
      };
    }
    if (region === "balkan") {
      return {
        presets: [10, 15, 20],
        defaultIndex: 1,
        defaultPercent: 15,
        showProminent: false,
      };
    }
    return {
      presets: [10, 15, 20],
      defaultIndex: 1,
      defaultPercent: 15,
      showProminent: true,
    };
  }

  if (score >= EXPERIENCE_LOW_THRESHOLD) {
    if (region === "us") {
      return {
        presets: [10, 15, 18],
        defaultIndex: 1,
        defaultPercent: 15,
        showProminent: true,
      };
    }
    if (region === "balkan") {
      return {
        presets: [5, 10, 15],
        defaultIndex: 0,
        defaultPercent: 5,
        showProminent: false,
      };
    }
    return {
      presets: [5, 10, 15],
      defaultIndex: 1,
      defaultPercent: 10,
      showProminent: true,
    };
  }

  return {
    presets: [0, 5, 10],
    defaultIndex: 0,
    defaultPercent: 0,
    showProminent: false,
  };
}

function resolveNeutralPresets(region: TipMarketRegion): ScoreBandPresets {
  if (region === "us") {
    return {
      presets: [15, 18, 22],
      defaultIndex: 1,
      defaultPercent: 18,
      showProminent: true,
    };
  }
  if (region === "balkan") {
    return {
      presets: [5, 10, 15],
      defaultIndex: 0,
      defaultPercent: 5,
      showProminent: false,
    };
  }
  return {
    presets: [10, 15, 20],
    defaultIndex: 0,
    defaultPercent: 10,
    showProminent: true,
  };
}

function buildPersonalMessage(input: {
  sentiment: TipSuggestion["sentiment"];
  waiterName?: string | null;
  language?: string;
  region: TipMarketRegion;
  showProminent: boolean;
}): string | null {
  const lang = (input.language ?? "sr").toLowerCase().slice(0, 2);
  const waiter = input.waiterName?.trim();

  if (!input.showProminent) {
    if (input.sentiment === "positive" && waiter) {
      if (lang === "de") {
        return `Danke für Ihren Besuch! Ihr Service heute: ${waiter} 😊`;
      }
      if (lang === "en") {
        return `Thanks for visiting! Your server today: ${waiter} 😊`;
      }
      return `Hvala na posjeti! Vaš konobar danas: ${waiter} 😊`;
    }
    if (lang === "de") return "Trinkgeld ist optional.";
    if (lang === "en") return "Tips are optional.";
    return "Napojnica je opcionalna.";
  }

  if (input.sentiment === "positive") {
    if (lang === "de") {
      return waiter
        ? `Danke für Ihren Besuch! Ihr Service heute: ${waiter} 😊`
        : "Schön, dass Sie zufrieden sind! Möchten Sie ein Trinkgeld hinterlassen?";
    }
    if (lang === "en") {
      return waiter
        ? `Thanks for visiting! Your server today: ${waiter} 😊`
        : input.region === "us"
          ? "Glad you enjoyed it! Tips help our team — thank you!"
          : "Glad you enjoyed it! Would you like to leave a tip?";
    }
    return waiter
      ? `Hvala na posjeti! Vaš konobar danas: ${waiter} 😊`
      : "Drago nam je da ste zadovoljni! Želite li ostaviti napojnicu?";
  }

  if (input.sentiment === "negative") {
    if (lang === "de") {
      return "Trinkgeld ist optional — jeder Betrag ist willkommen.";
    }
    if (lang === "en") {
      return "Tips are optional — any amount is welcome.";
    }
    return "Napojnica je opcionalna — svaki iznos je dobrodošao.";
  }

  if (lang === "de") {
    return "Trinkgeld ist optional — danke für Ihren Besuch.";
  }
  if (lang === "en") {
    return input.region === "us"
      ? "Tips are appreciated — thank you for visiting."
      : "Tips are optional — thank you for visiting.";
  }
  return "Napojnica je opcionalna — hvala na posjeti.";
}

/** Denis post-settle line — omitted when experience score is low (no pressure). */
export function buildSettlingTipDenisMessage(input: {
  language?: string;
  experienceScore: number;
  waiterName?: string | null;
}): string | null {
  if (input.experienceScore < EXPERIENCE_LOW_THRESHOLD) return null;

  const lang = (input.language ?? "sr").toLowerCase().slice(0, 2);
  const waiter = input.waiterName?.trim();

  if (lang === "de") {
    return waiter
      ? `Ich hoffe, es hat Ihnen geschmeckt! Wenn Sie möchten, können Sie ein Trinkgeld für ${waiter} und unser Team hinterlassen 🙂`
      : "Ich hoffe, es hat Ihnen geschmeckt! Wenn Sie möchten, können Sie ein Trinkgeld für unser Team hinterlassen 🙂";
  }
  if (lang === "en") {
    return waiter
      ? `Hope you enjoyed your visit! If you'd like, you can leave a tip for ${waiter} and our team 🙂`
      : "Hope you enjoyed your visit! If you'd like, you can leave a tip for our team 🙂";
  }
  return waiter
    ? `Nadam se da ste uživali! Ako želite, možete ostaviti napojnicu za ${waiter} i naš tim 🙂`
    : "Nadam se da ste uživali! Ako želite, možete ostaviti napojnicu za naš tim 🙂";
}

/** P37 — smart tip presets from experience score + cultural region. */
export function resolveTipSuggestion(input: TipSuggestionInput): TipSuggestion {
  const rating = inferRating({
    feedbackRating: input.feedbackRating,
    feedbackSentiment: input.feedbackSentiment,
  });
  const sentiment = resolveSentiment(rating, input.frustrationLevel);
  const region = resolveTipMarketRegion({
    language: input.language,
    marketRegion: input.marketRegion,
  });

  const experienceScore =
    input.experienceScore != null ? input.experienceScore : null;

  let band: ScoreBandPresets;
  if (experienceScore != null) {
    band = resolveScoreBandPresets(experienceScore, region);
  } else if (input.frustrationLevel === "high" || (rating != null && rating < 3)) {
    band = {
      presets: [0, 5, 10],
      defaultIndex: 0,
      defaultPercent: 0,
      showProminent: false,
    };
  } else if (rating != null && rating >= 4 && input.isReturningGuest) {
    band =
      region === "us"
        ? { presets: [18, 22, 25], defaultIndex: 1, defaultPercent: 22, showProminent: true }
        : { presets: [15, 20, 25], defaultIndex: 1, defaultPercent: 20, showProminent: true };
  } else if (rating != null && rating >= 4) {
    band = resolveScoreBandPresets(EXPERIENCE_HIGH_THRESHOLD + 0.1, region);
  } else {
    band = resolveNeutralPresets(region);
  }

  void input.waitTimeMinutes;
  void input.venueAvgTipPercent;

  const denisMessage =
    experienceScore != null
      ? buildSettlingTipDenisMessage({
          language: input.language,
          experienceScore,
          waiterName: input.waiterName,
        })
      : null;

  const personalMessage = buildPersonalMessage({
    sentiment,
    waiterName: input.waiterName,
    language: input.language,
    region,
    showProminent: band.showProminent,
  });

  return {
    presets: band.presets,
    defaultIndex: band.defaultIndex,
    defaultPercent: band.defaultPercent,
    personalMessage,
    denisMessage,
    sentiment,
    showProminent: band.showProminent,
    titleKey: "tip.title",
    allowSkip: true,
    experienceScore,
    marketRegion: region,
  };
}

export function tipAmountFromPercent(
  orderTotal: number,
  percent: number
): number {
  return Math.round(orderTotal * (percent / 100) * 100) / 100;
}

export function formatStaffTipCelebrationLine(input: {
  tableName: string;
  tipPercent: number;
  tipAmount: number;
  staffName?: string | null;
  currency?: string;
  splitMode?: TipSplitMode;
}): string {
  const amount = input.tipAmount.toFixed(2);
  const staff = input.staffName?.trim();
  const pool = input.splitMode === "pool";

  if (staff && !pool) {
    return `${input.tableName}: napojnica ${input.tipPercent}% (${amount} ${input.currency ?? "€"}) — hvala ${staff}`;
  }
  if (pool) {
    return `${input.tableName}: napojnica ${input.tipPercent}% (${amount} ${input.currency ?? "€"}) — tim pool`;
  }
  return `${input.tableName}: napojnica ${input.tipPercent}% (${amount} ${input.currency ?? "€"})`;
}

export type TipOrderRow = {
  tipAmount: number;
  orderTotal: number;
  createdAt: string;
  smartDefaultUsed?: boolean;
  denisPromptShown?: boolean;
};

export type TipAnalyticsSnapshot = {
  tipCount: number;
  tipTotal: number;
  avgTipPercent: number;
  denisPromptCount: number;
  denisPromptConverted: number;
  denisCorrelation: number;
  daily: Array<{
    date: string;
    tipCount: number;
    tipTotal: number;
    avgTipPercent: number;
  }>;
};

export function aggregateTipAnalytics(
  orders: TipOrderRow[]
): TipAnalyticsSnapshot {
  const dailyMap = new Map<
    string,
    { tipCount: number; tipTotal: number; percentSum: number }
  >();

  let tipCount = 0;
  let tipTotal = 0;
  let percentSum = 0;
  let denisPromptCount = 0;
  let denisPromptConverted = 0;

  for (const order of orders) {
    if (order.tipAmount <= 0) continue;
    tipCount += 1;
    tipTotal += order.tipAmount;
    const pct =
      order.orderTotal > 0
        ? (order.tipAmount / order.orderTotal) * 100
        : 0;
    percentSum += pct;

    const day = order.createdAt.slice(0, 10);
    const bucket = dailyMap.get(day) ?? {
      tipCount: 0,
      tipTotal: 0,
      percentSum: 0,
    };
    bucket.tipCount += 1;
    bucket.tipTotal += order.tipAmount;
    bucket.percentSum += pct;
    dailyMap.set(day, bucket);

    if (order.denisPromptShown) {
      denisPromptCount += 1;
      denisPromptConverted += 1;
    } else if (order.smartDefaultUsed) {
      denisPromptConverted += 1;
    }
  }

  const daily = [...dailyMap.entries()]
    .map(([date, bucket]) => ({
      date,
      tipCount: bucket.tipCount,
      tipTotal: Math.round(bucket.tipTotal * 100) / 100,
      avgTipPercent:
        bucket.tipCount > 0
          ? Math.round((bucket.percentSum / bucket.tipCount) * 10) / 10
          : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const denisCorrelation =
    denisPromptCount > 0
      ? Math.round((denisPromptConverted / denisPromptCount) * 1000) / 1000
      : 0;

  return {
    tipCount,
    tipTotal: Math.round(tipTotal * 100) / 100,
    avgTipPercent:
      tipCount > 0 ? Math.round((percentSum / tipCount) * 10) / 10 : 0,
    denisPromptCount,
    denisPromptConverted,
    denisCorrelation,
    daily,
  };
}
