import { describe, expect, it } from "vitest";
import { foldBrowseProfile } from "@/lib/denis/cognition/browse/fold-browse-profile";
import { buildScrollIntelligenceSection } from "@/lib/denis/cognition/context/build-scroll-intelligence-section";
import { detectScrollInterestTrigger } from "@/lib/denis/cognition/proactive/detect-scroll-interest-trigger";
import { consumeClientNudgeBudget } from "@/lib/denis/cognition/mental-model/consume-client-nudge-budget";
import { emptyBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import {
  buildScrollBrowseEvent,
  buildNudgeBrowseTelemetryEvent,
  canShowClientNudge,
  classifyScrollVelocity,
  deriveClientNudgeBudget,
  detectScrollIntentFromSample,
  resolveNudgeAbVariant,
  resolveNudgeMessage,
  scrollSignalToNudgeKind,
  shouldStopClientNudges,
} from "@/lib/guest/scroll-intelligence";
import { rankProactiveCandidates } from "@/lib/denis/cognition/proactive/rank-proactive-candidates";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";

describe("scroll velocity classification", () => {
  it("detects fast scroll as search intent", () => {
    expect(classifyScrollVelocity(1200)).toBe("fast");

    const signal = detectScrollIntentFromSample({
      velocityPxPerSec: 1200,
      categoryDwellMs: 500,
      atBottom: false,
    });

    expect(signal?.intent).toBe("fast_search");
    expect(scrollSignalToNudgeKind("fast_search")).toBe("scroll_search");
  });

  it("detects slow category dwell as category interest", () => {
    const signal = detectScrollIntentFromSample({
      velocityPxPerSec: 80,
      categoryDwellMs: 5000,
      atBottom: false,
      categoryId: "burgers",
      categoryLabel: "Burgeri",
    });

    expect(signal?.intent).toBe("slow_category");
    expect(scrollSignalToNudgeKind("slow_category")).toBe("scroll_category");
  });

  it("detects bottom reached intent", () => {
    const signal = detectScrollIntentFromSample({
      velocityPxPerSec: 200,
      categoryDwellMs: 1000,
      atBottom: true,
    });

    expect(signal?.intent).toBe("reached_bottom");
  });
});

describe("client nudge budget", () => {
  it("stops nudges after 3 dismissals", () => {
    expect(shouldStopClientNudges(2)).toBe(false);
    expect(shouldStopClientNudges(3)).toBe(true);

    const budget = deriveClientNudgeBudget({ shown: 2, dismissed: 3 });
    expect(budget.stopped).toBe(true);
    expect(budget.remaining).toBe(0);
    expect(
      canShowClientNudge({
        budget,
        dismissKey: "timed_nudge",
        dismissedKeys: new Set(["a", "b", "c"]),
      })
    ).toBe(false);
  });

  it("maps client budget into GuestNudgeBudget shape", () => {
    const budget = consumeClientNudgeBudget({ shown: 1, dismissed: 1 });
    expect(budget.remaining).toBe(2);
    expect(budget.max).toBe(3);
  });
});

describe("nudge A/B messaging", () => {
  it("returns stable variant per session and kind", () => {
    const first = resolveNudgeAbVariant("session-1", "scroll_search");
    const second = resolveNudgeAbVariant("session-1", "scroll_search");
    expect(first).toBe(second);
  });

  it("builds category-aware scroll message", () => {
    const { message } = resolveNudgeMessage({
      kind: "scroll_category",
      sessionKey: "session-abc",
      categoryLabel: "Pizza",
    });
    expect(message.length).toBeGreaterThan(0);
  });
});

describe("Denis browse + situation pack wiring", () => {
  it("folds scroll_menu events into browse profile", () => {
    const profile = foldBrowseProfile([
      {
        id: "row-1",
        ai_session_id: "sess-1",
        seq: 1,
        event_type: "perception.ingested",
        trace_id: "trace-1",
        context_hash: null,
        created_at: "2026-06-07T12:00:00.000Z",
        payload: {
          type: "perception.ingested",
          frame: {
            channel: "telemetry.browse",
            normalizedText: null,
            structuredIntent: null,
            ingestedAt: "2026-06-07T12:00:00.000Z",
          },
          browseEvent: buildScrollBrowseEvent({
            signal: {
              intent: "fast_search",
              velocityPxPerSec: 1500,
              at: Date.parse("2026-06-07T12:00:00.000Z"),
            },
            now: new Date("2026-06-07T12:00:00.000Z"),
          }),
        },
      },
    ]);

    expect(profile.scrollIntents).toHaveLength(1);
    expect(buildScrollIntelligenceSection(profile)).toContain("fast_search");
  });

  it("emits proactive scroll_interest trigger from browse profile", () => {
    const browse = {
      ...emptyBrowseProfile(),
      scrollIntents: [
        {
          intent: "slow_category" as const,
          categoryLabel: "Burgeri",
          at: "2026-06-07T12:00:00.000Z",
        },
      ],
    };

    const trigger = detectScrollInterestTrigger({ browse });
    expect(trigger?.kind).toBe("scroll_category");
    expect(trigger?.message).toContain("Burgeri");
  });
});

describe("proactive scroll_interest ranking", () => {
  it("ranks scroll_category above generic browse_nudge", () => {
    const browse = {
      ...emptyBrowseProfile(),
      scrollIntents: [
        {
          intent: "slow_category" as const,
          categoryLabel: "Burgeri",
          at: "2026-06-07T12:00:00.000Z",
        },
      ],
    };

    const ranked = rankProactiveCandidates({
      config: CONCIERGE_PLATFORM_DEFAULTS,
      orders: [],
      browse,
      payload: {
        browseMinutes: 1,
        cartItemCount: 0,
        dismissedNudgeKeys: [],
      },
      messages: {
        browse: "Generic browse",
        dessert: "",
        slowKitchen: "",
        guestWelcome: "",
        browseFollowUp: "",
        billPrompt: "",
        orderDelay: "",
        popularityPair: "",
      },
    });

    expect(ranked[0]?.nudge.kind).toBe("scroll_category");
    expect(ranked[0]?.nudge.message).toContain("Burgeri");
  });
});

describe("nudge A/B browse telemetry", () => {
  it("maps click-through events to nudge_interaction browse events", () => {
    const event = buildNudgeBrowseTelemetryEvent({
      kind: "scroll_search",
      variant: "B",
      action: "click",
      at: "2026-06-07T12:00:00.000Z",
    });

    expect(event.action).toBe("nudge_interaction");
    expect(event.nudgeKind).toBe("scroll_search");
    expect(event.nudgeVariant).toBe("B");
    expect(event.nudgeAction).toBe("click");
  });
});
