import { describe, expect, it } from "vitest";
import { rankProactiveCandidates } from "@/lib/denis/cognition/proactive/rank-proactive-candidates";
import {
  detectAllergyMention,
  detectStaffProactiveAlerts,
  detectWaiterRequest,
} from "@/lib/denis/cognition/proactive/detect-staff-proactive";
import { buildSessionWatcherContext } from "@/lib/denis/cognition/proactive/session-watcher-context";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import type { AiGuestOrder } from "@/lib/ai/order-context";

const messages = {
  browse: "Treba vam pomoć pri biranju?",
  dessert: "Spremni za desert?",
  slowKitchen: "Kuhinja radi intenzivno?",
  guestWelcome: "Dobro došli!",
  browseFollowUp: "Da li ste odlučili?",
  billPrompt: "Hoćete račun?",
  orderDelay: "Stiže uskoro.",
  popularityPair: "Popularan par.",
};

describe("session watcher proactive detection", () => {
  it("emits guest_welcome after 30s with zero guest messages", () => {
    const nudge = rankProactiveCandidates({
      config: CONCIERGE_PLATFORM_DEFAULTS,
      orders: [],
      payload: {
        guestMessageCount: 0,
        sessionAgeSeconds: 35,
        dismissedNudgeKeys: [],
      },
      messages,
    });

    expect(nudge[0]?.nudge.kind).toBe("guest_welcome");
  });

  it("dedupes guest_welcome to once per session", () => {
    const nudge = rankProactiveCandidates({
      config: CONCIERGE_PLATFORM_DEFAULTS,
      orders: [],
      payload: {
        guestMessageCount: 0,
        sessionAgeSeconds: 60,
        dismissedNudgeKeys: ["guest_welcome"],
      },
      messages,
    });

    expect(nudge[0]).toBeUndefined();
  });

  it("emits slow_kitchen for preparing order past threshold", () => {
    const now = Date.now();
    const orders: AiGuestOrder[] = [
      {
        id: "order-1",
        status: "preparing",
        created_at: new Date(now - 20 * 60_000).toISOString(),
        delivered_at: null,
        order_items: [
          {
            product_id: "p1",
            product_name: "Burger",
            unit_price: 12,
            quantity: 1,
            menu_section: "food",
          },
        ],
      },
    ];

    const nudge = rankProactiveCandidates({
      config: CONCIERGE_PLATFORM_DEFAULTS,
      orders,
      payload: { dismissedNudgeKeys: [] },
      messages,
      now,
    });

    expect(nudge[0]?.nudge.kind).toBe("slow_kitchen");
    expect(nudge[0]?.nudge.orderId).toBe("order-1");
  });

  it("builds idle minutes from timeline guest activity", () => {
    const openedAt = new Date(Date.now() - 30 * 60_000).toISOString();
    const context = buildSessionWatcherContext({
      sessionOpenedAt: openedAt,
      orders: [],
      timeline: [
        {
          id: "e1",
          ai_session_id: "ai-1",
          seq: 1,
          event_type: "perception.ingested",
          payload: {
            frame: { normalizedText: "Pivo molim" },
          },
          trace_id: "t1",
          context_hash: null,
          created_at: new Date(Date.now() - 25 * 60_000).toISOString(),
        },
      ],
    });

    expect(context.guestMessageCount).toBe(1);
    expect(context.idleMinutes).toBeGreaterThan(20);
  });
});

describe("staff proactive alerts", () => {
  it("detects waiter request and allergy mentions", () => {
    expect(detectWaiterRequest("Može konobar molim?")).toBe(true);
    expect(detectAllergyMention("Imam alergiju na kikiriki")).toContain(
      "alergiju"
    );
  });

  it("emits staff table idle alert once", () => {
    const alerts = detectStaffProactiveAlerts({
      config: CONCIERGE_PLATFORM_DEFAULTS,
      tableName: "7",
      idleMinutes: 18,
      emittedKeys: [],
      recentGuestMessages: [],
      waiterEscalated: false,
    });

    expect(alerts[0]?.kind).toBe("staff_table_idle");
    expect(alerts[0]?.message).toContain("Sto 7");
  });
});
