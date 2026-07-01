import { describe, expect, it } from "vitest";
import {
  DEFAULT_WAITLIST_CONFIG,
  buildDenisWaitlistGreeting,
  buildTableReadyNotification,
  buildWaitlistProactiveMessage,
  estimateWaitTime,
  estimateWaitTimeSmart,
  formatEstimatedWaitLabel,
  pickBestTableForParty,
  pickNextWaitingEntry,
  reorderWaitlistQueue,
  resolveNoShowEntries,
  resolveWaitlistPriority,
  sortWaitlistQueue,
  type WaitlistEntry,
} from "@/lib/denis/commerce/waitlist";
import { deriveWaitlistSessionPhase } from "@/lib/denis/loop/infer-session-phase";
import { scheduleWaitlistReadyPush } from "@/lib/push/schedule-notify";

describe("waitlist", () => {
  const floorBase = {
    activeTables: 3,
    avgTurnoverMinutes: 25,
    currentOccupancy: 1,
    imminentFreeTables: 0,
    wrappingTables: 0,
  };

  it("estimates wait for party at position 2 with 3 occupied tables", () => {
    const wait = estimateWaitTime({
      position: 2,
      activeTables: 3,
      avgTurnover: 25,
      currentOccupancy: 0.9,
    });
    expect(wait).toBeGreaterThanOrEqual(15);
    expect(wait).toBeLessThanOrEqual(20);
  });

  it("smart estimate: 3 tables, 1 settling → ~8 min for position 1", () => {
    const wait = estimateWaitTimeSmart({
      position: 1,
      floor: {
        ...floorBase,
        imminentFreeTables: 1,
      },
    });
    expect(wait).toBeGreaterThanOrEqual(7);
    expect(wait).toBeLessThanOrEqual(10);
  });

  it("never shows immediate wait when minutes > 0", () => {
    expect(formatEstimatedWaitLabel(17)).toBe("~17 min");
    expect(formatEstimatedWaitLabel(0)).not.toMatch(/odmah/i);
  });

  it("prioritizes VIP entries in queue sort", () => {
    const entries: WaitlistEntry[] = [
      {
        id: "1",
        guestName: "Ana",
        partySize: 2,
        joinedAt: new Date(Date.now() - 60_000).toISOString(),
        estimatedWaitMinutes: 10,
        status: "waiting",
        notifiedAt: null,
        deviceFingerprint: "a",
      },
      {
        id: "2",
        guestName: "Marko",
        partySize: 2,
        joinedAt: new Date().toISOString(),
        estimatedWaitMinutes: 5,
        status: "waiting",
        notifiedAt: null,
        deviceFingerprint: "b",
        priorityBoost: 2,
        isReturningGuest: true,
      },
    ];

    const sorted = sortWaitlistQueue(entries);
    expect(sorted[0]?.guestName).toBe("Marko");
  });

  it("wires loyalty + returning guest into priority boost", () => {
    const vip = resolveWaitlistPriority({
      loyaltyBoost: 3,
      isReturningGuest: true,
    });
    expect(vip.priorityBoost).toBe(4);

    const regular = resolveWaitlistPriority({
      loyaltyBoost: 0,
      isReturningGuest: true,
    });
    expect(regular.priorityBoost).toBeGreaterThanOrEqual(1);
  });

  it("no_show after 10 min timeout", () => {
    const notifiedAt = new Date(Date.now() - 11 * 60_000).toISOString();
    const entries: WaitlistEntry[] = [
      {
        id: "1",
        guestName: "Ana",
        partySize: 2,
        joinedAt: new Date().toISOString(),
        estimatedWaitMinutes: 10,
        status: "notified",
        notifiedAt,
        deviceFingerprint: "a",
      },
      {
        id: "2",
        guestName: "Next",
        partySize: 2,
        joinedAt: new Date().toISOString(),
        estimatedWaitMinutes: 8,
        status: "waiting",
        notifiedAt: null,
        deviceFingerprint: "b",
      },
    ];

    const resolved = resolveNoShowEntries(entries, DEFAULT_WAITLIST_CONFIG);
    expect(resolved[0]?.status).toBe("no_show");
    expect(pickNextWaitingEntry(resolved)?.guestName).toBe("Next");
  });

  it("table ready notification mentions 10 min grace", () => {
    const message = buildTableReadyNotification({
      guestName: "Ana",
      timeoutMinutes: 10,
      language: "sr",
    });
    expect(message).toContain("10");
    expect(message).toMatch(/spreman|dođete/i);
  });

  it("Denis proactive message after 10+ min wait", () => {
    const message = buildWaitlistProactiveMessage({
      waitedMinutes: 12,
      estimatedMinutes: 5,
      language: "sr",
    });
    expect(message).toMatch(/Još malo|~5 min|meni/i);
    expect(
      buildWaitlistProactiveMessage({
        waitedMinutes: 5,
        estimatedMinutes: 15,
      })
    ).toBeNull();
  });

  it("Denis greeting when venue is full", () => {
    expect(buildDenisWaitlistGreeting("sr")).toMatch(/puno/i);
  });

  it("reorders queue for host drag-and-drop", () => {
    const entries: WaitlistEntry[] = [
      {
        id: "a",
        guestName: "A",
        partySize: 2,
        joinedAt: new Date().toISOString(),
        estimatedWaitMinutes: 10,
        status: "waiting",
        notifiedAt: null,
        deviceFingerprint: "1",
      },
      {
        id: "b",
        guestName: "B",
        partySize: 2,
        joinedAt: new Date().toISOString(),
        estimatedWaitMinutes: 8,
        status: "waiting",
        notifiedAt: null,
        deviceFingerprint: "2",
      },
    ];
    const reordered = reorderWaitlistQueue(entries, ["b", "a"]);
    expect(reordered[0]?.id).toBe("b");
  });

  it("picks smallest suitable table for party size", () => {
    const tableId = pickBestTableForParty({
      partySize: 2,
      availableTables: [
        { id: "big", seats: 6 },
        { id: "small", seats: 4 },
        { id: "tiny", seats: 2 },
      ],
    });
    expect(tableId).toBe("tiny");
  });

  it("uses configured avg turnover in staff estimates", () => {
    expect(DEFAULT_WAITLIST_CONFIG.avgTurnoverMinutes).toBe(25);
    expect(DEFAULT_WAITLIST_CONFIG.noShowTimeoutMinutes).toBe(10);
  });

  it("waitlist session phase for entrance QR", () => {
    expect(deriveWaitlistSessionPhase(true)).toBe("waitlist");
    expect(deriveWaitlistSessionPhase(false)).toBe("browsing");
  });

  it("scheduleWaitlistReadyPush is exported", () => {
    expect(typeof scheduleWaitlistReadyPush).toBe("function");
  });
});
