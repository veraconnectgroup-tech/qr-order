import { describe, expect, it } from "vitest";
import { deriveAnomalies } from "@/lib/denis/cognition/mental-model/derive-anomalies";
import { deriveConversationFlow, isAbnormalIntentTransition } from "@/lib/denis/cognition/mental-model/derive-conversation-flow";
import { deriveGuestReadiness } from "@/lib/denis/cognition/mental-model/derive-guest-readiness";
import { emptyConversationModel } from "@/lib/denis/cognition/conversation/empty-conversation-model";
import { emptyBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import {
  deriveFusionStyle,
  synthesizePredictedNeed,
} from "@/lib/denis/cognition/mental-model/synthesize-predicted-need";

describe("mental model fusion (Prompt 92)", () => {
  it("rushed + open → short_direct style", () => {
    const readiness = deriveGuestReadiness({
      intent: "exploring",
      engagement: {
        guestTurns: 3,
        avgMsgLen: 8,
        guestInitiated: true,
        nudgeResponseRate: 0,
      },
      pace: "rushed",
      receptiveness: "open",
      cartLineCount: 0,
    });
    expect(
      deriveFusionStyle({
        pace: "rushed",
        receptiveness: "open",
        intent: "exploring",
        readiness,
        abnormalTransition: null,
      })
    ).toBe("short_direct");
  });

  it("exploring + mild frustration → helpful_discovery + needs_help_choosing", () => {
    const affect = {
      frustration: { level: "mild" as const, signals: ["waiting:where"] },
      sentiment: { score: -0.2, lastSignals: [] },
    };
    expect(
      synthesizePredictedNeed({
        intent: "exploring",
        mealStage: "pre_order",
        receptiveness: "neutral",
        pace: "normal",
        affect,
      })
    ).toBe("needs_help_choosing");
    expect(
      deriveFusionStyle({
        pace: "normal",
        receptiveness: "neutral",
        intent: "exploring",
        affect,
        readiness: { score: 0.5, band: "medium", offerSubmit: false },
        abnormalTransition: null,
      })
    ).toBe("helpful_discovery");
  });

  it("detects eating → ordering as abnormal", () => {
    expect(isAbnormalIntentTransition("eating", "ordering")).toBe(true);
    const flow = deriveConversationFlow({
      intent: "ordering",
      intentTransitions: [
        { from: "eating", to: "ordering", at: 1, durationMs: 60_000 },
      ],
    });
    expect(flow.abnormalTransition?.from).toBe("eating");
    expect(flow.hint).toBe("Jos nesto uz obrok?");
  });

  it("high readiness enables offerSubmit", () => {
    const readiness = deriveGuestReadiness({
      intent: "ordering",
      engagement: {
        guestTurns: 4,
        avgMsgLen: 24,
        guestInitiated: true,
        nudgeResponseRate: 0.5,
      },
      pace: "rushed",
      receptiveness: "enthusiastic",
      cartLineCount: 2,
    });
    expect(readiness.score).toBeGreaterThanOrEqual(0.8);
    expect(readiness.offerSubmit).toBe(true);
  });

  it("15min menu silence → gentle_nudge anomaly", () => {
    const now = Date.parse("2026-06-07T12:30:00.000Z");
    const anomalies = deriveAnomalies({
      spine: {
        guestMessages: [],
        declineSignals: [],
        browseChurn: [],
        maxProductCartChurn: 0,
        proactivePairs: [],
        emittedProactiveKeys: [],
        recommendationAsked: false,
        guestInitiatedBeforeDenis: false,
        actionTimestamps: [Date.parse("2026-06-07T12:00:00.000Z")],
      },
      browse: {
        ...emptyBrowseProfile(),
        viewedProducts: [
          {
            productId: "p1",
            productName: "Pasta",
            categoryPath: ["food"],
            viewCount: 1,
            totalDwellMs: 4000,
            addedToCart: false,
            removedFromCart: false,
            disposition: "viewed",
            lastViewedAt: "2026-06-07T12:00:00.000Z",
          },
        ],
      },
      conversation: emptyConversationModel(),
      intent: "exploring",
      cartLineCount: 0,
      now,
    });
    expect(anomalies.some((row) => row.suggestedAction === "gentle_nudge")).toBe(
      true
    );
  });
});
