import { describe, expect, it } from "vitest";
import {
  analyzeFeedbackComment,
  analyzeFeedbackTrends,
  buildFeedbackTrainingInsights,
  detectDishFeedbackTrend,
  formatFeedbackTags,
  resolveDishRecommendationPolicy,
  resolveFeedbackPostSubmit,
  staffCopilotFeedbackHint,
} from "@/lib/denis/platform/feedback-intelligence";
import type { FeedbackRow } from "@/lib/denis/platform/feedback-intelligence";

const NOW = Date.parse("2026-06-07T12:00:00.000Z");

function feedbackRow(
  daysAgo: number,
  input: Pick<FeedbackRow, "sentiment" | "category" | "rating"> & {
    comment?: string | null;
  }
): FeedbackRow {
  return {
    rating: input.rating,
    sentiment: input.sentiment,
    category: input.category,
    createdAt: new Date(NOW - daysAgo * 86_400_000).toISOString(),
    comment: input.comment ?? null,
  };
}

describe("resolveFeedbackPostSubmit", () => {
  it("routes rating=5 + positive to Google review prompt", () => {
    const flow = resolveFeedbackPostSubmit({
      rating: 5,
      sentiment: "positive",
      language: "sr",
    });

    expect(flow.kind).toBe("google_review");
    expect(flow.message).toContain("Google");
  });

  it("routes rating=2 to Denis follow-up", () => {
    const flow = resolveFeedbackPostSubmit({
      rating: 2,
      sentiment: "negative",
      language: "sr",
    });

    expect(flow.kind).toBe("denis_followup");
    expect(flow.message).toContain("Žao nam je");
  });
});

describe("analyzeFeedbackComment", () => {
  it("tags slow kitchen and cold food from comment text", () => {
    const analysis = analyzeFeedbackComment({
      rating: 2,
      comment: "Sporo iz kuhinje, hrana bila hladna",
    });

    expect(analysis.sentiment).toBe("negative");
    expect(analysis.category).toBe("wait_time");
    expect(analysis.tags).toEqual(
      expect.arrayContaining(["slow_kitchen", "cold_food"])
    );
    expect(formatFeedbackTags(analysis.tags)).toContain("#slow_kitchen");
  });

  it("detects great service on positive high rating", () => {
    const analysis = analyzeFeedbackComment({
      rating: 5,
      comment: "Odličan konobar, brzo i ljubazno",
    });

    expect(analysis.sentiment).toBe("positive");
    expect(analysis.tags).toContain("great_service");
  });
});

describe("detectDishFeedbackTrend", () => {
  it("alerts when 5 negative Schnitzel comments this week", () => {
    const feedbacks = Array.from({ length: 5 }, (_, index) => ({
      comment: "Schnitzel bio hladan i loš",
      sentiment: "negative" as const,
      createdAt: new Date(NOW - index * 86_400_000).toISOString(),
    }));

    const trend = detectDishFeedbackTrend({
      feedbacks,
      dishName: "Schnitzel",
      lookbackDays: 7,
      nowMs: NOW,
    });

    expect(trend.negativeCount).toBe(5);
    expect(trend.alertMessage).toContain("Schnitzel");
  });
});

describe("buildFeedbackTrainingInsights", () => {
  it("emits speed training insight after 5 slow service comments", () => {
    const feedbacks = Array.from({ length: 5 }, (_, index) => ({
      comment: "Spori servis, čekali konobara predugo",
      sentiment: "negative" as const,
      category: "service" as const,
      createdAt: new Date(NOW - index * 86_400_000).toISOString(),
    }));

    const insights = buildFeedbackTrainingInsights({
      feedbacks,
      lookbackDays: 7,
      periodDays: 7,
      nowMs: NOW,
    });

    expect(insights).toHaveLength(1);
    expect(insights[0]?.area).toBe("speed");
    expect(insights[0]?.dataPoints).toBe(5);
  });
});

describe("resolveDishRecommendationPolicy", () => {
  it("suppresses dishes below 3.5 average", () => {
    expect(resolveDishRecommendationPolicy(3.2)).toBe("suppress");
  });

  it("promotes dishes above 4.5 average", () => {
    expect(resolveDishRecommendationPolicy(4.8)).toBe("promote");
  });
});

describe("analyzeFeedbackTrends", () => {
  it("sets topComplaintCategory to wait_time for clustered negative wait feedback", () => {
    const feedbacks: FeedbackRow[] = [
      feedbackRow(1, { rating: 1, sentiment: "negative", category: "wait_time" }),
      feedbackRow(2, { rating: 2, sentiment: "negative", category: "wait_time" }),
      feedbackRow(3, { rating: 1, sentiment: "negative", category: "wait_time" }),
      feedbackRow(4, { rating: 2, sentiment: "negative", category: "wait_time" }),
      feedbackRow(5, { rating: 1, sentiment: "negative", category: "wait_time" }),
      feedbackRow(1, { rating: 5, sentiment: "positive", category: "food" }),
      feedbackRow(2, { rating: 4, sentiment: "positive", category: "food" }),
    ];

    const insight = analyzeFeedbackTrends(feedbacks, 7, NOW);

    expect(insight.topComplaintCategory).toBe("wait_time");
    expect(insight.topComplaintCount).toBe(5);
    expect(insight.negativeCount).toBe(5);
    expect(insight.actionRequired).toBe(true);
    expect(insight.suggestedFix).toContain("prep time");
  });

  it("surfaces wait_time staff copilot hint when negative rate is high", () => {
    const insight = analyzeFeedbackTrends(
      [
        feedbackRow(1, { rating: 1, sentiment: "negative", category: "wait_time" }),
        feedbackRow(2, { rating: 2, sentiment: "negative", category: "wait_time" }),
        feedbackRow(3, { rating: 1, sentiment: "negative", category: "wait_time" }),
        feedbackRow(4, { rating: 5, sentiment: "positive", category: "food" }),
      ],
      7,
      NOW
    );

    expect(staffCopilotFeedbackHint(insight)).toContain("čekanje");
  });

  it("detects improving trend when positive rate rises vs prior period", () => {
    const feedbacks: FeedbackRow[] = [
      feedbackRow(1, { rating: 5, sentiment: "positive", category: "food" }),
      feedbackRow(2, { rating: 5, sentiment: "positive", category: "food" }),
      feedbackRow(3, { rating: 4, sentiment: "positive", category: "food" }),
      feedbackRow(10, { rating: 2, sentiment: "negative", category: "service" }),
      feedbackRow(11, { rating: 2, sentiment: "negative", category: "service" }),
      feedbackRow(12, { rating: 3, sentiment: "neutral", category: "other" }),
    ];

    const insight = analyzeFeedbackTrends(feedbacks, 7, NOW);

    expect(insight.trendDirection).toBe("improving");
    expect(insight.positiveRate).toBeGreaterThan(0.8);
  });
});

describe("buildReturnGuestWelcomeMessage feedback memory", () => {
  it("uses warm welcome for returning guests with positive prior feedback", async () => {
    const { buildReturnGuestWelcomeMessage } = await import(
      "@/lib/denis/learning/guest-memory/build-welcome-message"
    );

    expect(
      buildReturnGuestWelcomeMessage({
        language: "sr",
        lastVisitItems: ["Burger"],
        visitCount: 3,
        lastFeedbackSentiment: "positive",
      })
    ).toContain("Burger");
  });
});
