import { describe, expect, it } from "vitest";
import type { BrowseEvent } from "@/lib/denis/cognition/browse/browse-types";
import { foldBrowseProfile } from "@/lib/denis/cognition/browse/fold-browse-profile";
import {
  detectBrowseProductFollowUp,
  detectCategoryBrowseNudge,
} from "@/lib/denis/cognition/browse/detect-browse-triggers";
import { buildBrowseContextSection } from "@/lib/denis/cognition/context/build-browse-context-section";
import { derivePriceAffinity } from "@/lib/denis/cognition/mental-model/derive-price-affinity";
import { rankProactiveCandidates } from "@/lib/denis/cognition/proactive/rank-proactive-candidates";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

const AI = "00000000-0000-4000-8000-000000000099";
const NOW = Date.parse("2026-06-27T20:00:00.000Z");

function browseRow(seq: number, event: BrowseEvent): DenisTimelineRow {
  return {
    id: `browse-${seq}`,
    ai_session_id: AI,
    seq,
    event_type: "perception.ingested",
    payload: {
      type: "perception.ingested",
      frame: {
        channel: "telemetry.browse",
        normalizedText: String(event.productName ?? event.categoryPath ?? ""),
        structuredIntent: "BROWSE",
        ingestedAt: String(event.timestamp),
      },
      envelope: { traceId: `trace-${seq}`, surface: "sense" },
      browseEvent: event,
    },
    trace_id: `trace-${seq}`,
    context_hash: null,
    created_at: event.timestamp,
  };
}

function saladTimeline(): DenisTimelineRow[] {
  const salads = [
    { id: "11111111-1111-4111-8111-111111111101", name: "Greek Salad" },
    { id: "11111111-1111-4111-8111-111111111102", name: "Caesar Salad" },
    { id: "11111111-1111-4111-8111-111111111103", name: "Garden Salad" },
  ];

  return salads.map((salad, index) =>
    browseRow(index + 1, {
      action: "close_product",
      productId: salad.id,
      productName: salad.name,
      categoryId: "cat-salads",
      categoryPath: ["food", "salads"],
      menuSection: "food",
      dwellMs: 6_000,
      timestamp: new Date(NOW - (180 - index * 30) * 60_000).toISOString(),
    })
  );
}

describe("foldBrowseProfile browse intelligence", () => {
  it("classifies viewed, interested, and abandoned products", () => {
    const profile = foldBrowseProfile([
      browseRow(1, {
        action: "close_product",
        productId: "11111111-1111-4111-8111-111111111111",
        productName: "Caesar Salad",
        categoryId: "cat-salads",
        categoryPath: ["food", "salads"],
        menuSection: "food",
        dwellMs: 6_500,
        timestamp: "2026-06-27T19:50:00.000Z",
      }),
      browseRow(2, {
        action: "close_product",
        productId: "22222222-2222-4222-8222-222222222222",
        productName: "Soup",
        categoryId: "cat-soups",
        categoryPath: ["food", "soups"],
        menuSection: "food",
        dwellMs: 1_800,
        timestamp: "2026-06-27T19:52:00.000Z",
      }),
    ]);

    expect(profile.viewedProducts[0]?.disposition).toBe("interested");
    expect(profile.interestedProducts[0]?.productName).toBe("Caesar Salad");
    expect(profile.abandonedProducts[0]?.productName).toBe("Soup");
  });

  it("derives budget price affinity when only cheap items are opened", () => {
    const profile = foldBrowseProfile([
      browseRow(1, {
        action: "close_product",
        productId: "11111111-1111-4111-8111-111111111111",
        productName: "Daily Special",
        categoryPath: ["food"],
        menuSection: "food",
        dwellMs: 4_000,
        unitPrice: 8.5,
        timestamp: "2026-06-27T19:50:00.000Z",
      }),
      browseRow(2, {
        action: "close_product",
        productId: "22222222-2222-4222-8222-222222222222",
        productName: "Side Salad",
        categoryPath: ["food", "salads"],
        menuSection: "food",
        dwellMs: 3_500,
        unitPrice: 9,
        timestamp: "2026-06-27T19:52:00.000Z",
      }),
    ]);

    expect(profile.priceBrowseStats.onlyBudgetItems).toBe(true);
    expect(derivePriceAffinity(profile)).toBe("budget");
  });
});

describe("detectCategoryBrowseNudge", () => {
  it("fires after 3 salads viewed over 3+ minutes without ordering", () => {
    const profile = foldBrowseProfile(saladTimeline());
    const nudge = detectCategoryBrowseNudge({
      browse: profile,
      hasOrdered: false,
      language: "sr",
      nowMs: NOW,
    });

    expect(nudge).not.toBeNull();
    expect(nudge?.categoryLabel).toBe("salads");
    expect(nudge?.message).toContain("salate");
    expect(nudge?.message).toContain("Caesar salata");
  });

  it("ranks browse_nudge with category copy in proactive candidates", () => {
    const profile = foldBrowseProfile(saladTimeline());
    const ranked = rankProactiveCandidates({
      config: CONCIERGE_PLATFORM_DEFAULTS,
      orders: [],
      payload: {
        language: "sr",
        browseMinutes: 4,
        dismissedNudgeKeys: [],
      },
      browse: profile,
      messages: {
        browse: "Treba vam pomoć pri biranju?",
        dessert: "Desert?",
        slowKitchen: "Busy",
        guestWelcome: "Welcome",
        browseFollowUp: "Odlučili ste?",
        billPrompt: "Račun?",
        orderDelay: "Delay",
        popularityPair: "Pair",
      },
      now: NOW,
    });

    const categoryNudge = ranked.find((row) =>
      row.source.startsWith("browse_category:")
    );
    expect(categoryNudge?.nudge.kind).toBe("browse_nudge");
    expect(categoryNudge?.nudge.message).toContain("salate");
  });
});

describe("detectBrowseProductFollowUp", () => {
  it("follows up on interested product after 5 minutes", () => {
    const profile = foldBrowseProfile([
      browseRow(1, {
        action: "close_product",
        productId: "11111111-1111-4111-8111-111111111111",
        productName: "Ribeye Steak",
        categoryPath: ["food", "steaks"],
        menuSection: "food",
        dwellMs: 8_000,
        timestamp: new Date(NOW - 6 * 60_000).toISOString(),
      }),
    ]);

    const followUp = detectBrowseProductFollowUp({
      browse: profile,
      hasOrdered: false,
      language: "sr",
      nowMs: NOW,
    });

    expect(followUp?.productName).toBe("Ribeye Steak");
    expect(followUp?.message).toContain("Ribeye Steak");
    expect(followUp?.message).toContain("Mogu odgovoriti");
  });
});

describe("buildBrowseContextSection", () => {
  it("includes BROWSE CONTEXT block for LLM situation pack", () => {
    const profile = foldBrowseProfile(saladTimeline());
    const block = buildBrowseContextSection(profile);

    expect(block).toContain("BROWSE CONTEXT:");
    expect(block).toContain("category_focus:");
    expect(block).toContain("salads");
  });
});
