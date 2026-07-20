import { afterEach, describe, expect, it, vi } from "vitest";
import type { VenueSurveySnapshot } from "@/lib/denis/venue/venue-survey-types";

const QUIET_SNAPSHOT: VenueSurveySnapshot = {
  locationId: "loc-1",
  kitchenQueueDepth: 3,
  kitchenRushMode: false,
  barQueueDepth: 1,
  overloadedStation: null,
  openMissionCount: 0,
  openMissionTitles: [],
  overdueCommitmentCount: 0,
  activeTableCount: 5,
};

describe("assessVenueSurvey — Denis's own unprompted venue judgment", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("parses a 'nothing needs attention' decision", async () => {
    vi.doMock("@/lib/ai/openai-client", () => ({
      callOpenAiChat: vi.fn().mockResolvedValue({
        content: JSON.stringify({
          needsAttention: false,
          title: null,
          summary: null,
          urgency: null,
          reasoning: "Ordinary shift, nothing building up.",
        }),
        tokensUsed: 10,
        promptTokens: 5,
        completionTokens: 5,
        model: "test",
      }),
    }));
    vi.doMock("@/lib/ai/config", () => ({ isOpenAiConfigured: () => true }));
    const { assessVenueSurvey } = await import(
      "@/lib/denis/cognition/perceive/assess-venue-survey"
    );

    const result = await assessVenueSurvey(QUIET_SNAPSHOT);

    expect(result?.needsAttention).toBe(false);
    expect(result?.reasoning).toBeTruthy();
  });

  it("parses a genuine 'needs attention' decision with title/summary/urgency", async () => {
    vi.doMock("@/lib/ai/openai-client", () => ({
      callOpenAiChat: vi.fn().mockResolvedValue({
        content: JSON.stringify({
          needsAttention: true,
          title: "Kitchen backlog building",
          summary: "Queue depth well above normal for 20+ minutes.",
          urgency: "urgent",
          reasoning: "Kitchen rush mode active with no sign of easing.",
        }),
        tokensUsed: 10,
        promptTokens: 5,
        completionTokens: 5,
        model: "test",
      }),
    }));
    vi.doMock("@/lib/ai/config", () => ({ isOpenAiConfigured: () => true }));
    const { assessVenueSurvey } = await import(
      "@/lib/denis/cognition/perceive/assess-venue-survey"
    );

    const result = await assessVenueSurvey({
      ...QUIET_SNAPSHOT,
      kitchenQueueDepth: 22,
      kitchenRushMode: true,
      overloadedStation: "kitchen",
    });

    expect(result?.needsAttention).toBe(true);
    expect(result?.title).toBe("Kitchen backlog building");
    expect(result?.urgency).toBe("urgent");
  });

  it("returns null when OpenAI is not configured", async () => {
    vi.doMock("@/lib/ai/openai-client", () => ({ callOpenAiChat: vi.fn() }));
    vi.doMock("@/lib/ai/config", () => ({ isOpenAiConfigured: () => false }));
    const { assessVenueSurvey } = await import(
      "@/lib/denis/cognition/perceive/assess-venue-survey"
    );
    const { callOpenAiChat } = await import("@/lib/ai/openai-client");

    const result = await assessVenueSurvey(QUIET_SNAPSHOT);

    expect(result).toBeNull();
    expect(callOpenAiChat).not.toHaveBeenCalled();
  });

  it("returns null on malformed LLM output instead of throwing", async () => {
    vi.doMock("@/lib/ai/openai-client", () => ({
      callOpenAiChat: vi.fn().mockResolvedValue({
        content: "not json",
        tokensUsed: 10,
        promptTokens: 5,
        completionTokens: 5,
        model: "test",
      }),
    }));
    vi.doMock("@/lib/ai/config", () => ({ isOpenAiConfigured: () => true }));
    const { assessVenueSurvey } = await import(
      "@/lib/denis/cognition/perceive/assess-venue-survey"
    );

    const result = await assessVenueSurvey(QUIET_SNAPSHOT);

    expect(result).toBeNull();
  });

  it("returns null when the LLM call throws", async () => {
    vi.doMock("@/lib/ai/openai-client", () => ({
      callOpenAiChat: vi.fn().mockRejectedValue(new Error("network error")),
    }));
    vi.doMock("@/lib/ai/config", () => ({ isOpenAiConfigured: () => true }));
    const { assessVenueSurvey } = await import(
      "@/lib/denis/cognition/perceive/assess-venue-survey"
    );

    const result = await assessVenueSurvey(QUIET_SNAPSHOT);

    expect(result).toBeNull();
  });
});
