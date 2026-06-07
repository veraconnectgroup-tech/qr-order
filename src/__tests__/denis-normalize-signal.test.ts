import { describe, expect, it } from "vitest";
import { normalizeDenisSignal } from "@/lib/denis/ingress/normalize-signal";

describe("normalizeDenisSignal", () => {
  it("routes waiter chip to handoff", () => {
    const result = normalizeDenisSignal({
      type: "chip",
      chipId: "situation-waiter",
      label: "Kellner rufen",
      tableToken: "abc123def456ghi789jkl012mno345pq",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.signal.route).toBe("handoff");
    expect(result.signal.structuredIntent).toBe("HANDOFF_WAITER");
  });

  it("routes payment chip with method to handoff", () => {
    const result = normalizeDenisSignal({
      type: "chip",
      chipId: "pay-online",
      label: "Online bezahlen",
      tableToken: "abc123def456ghi789jkl012mno345pq",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.signal.route).toBe("handoff");
    expect(result.signal.structuredIntent).toBe("HANDOFF_PAY");
    expect(result.signal.handoffPaymentMethod).toBe("online");
  });

  it("routes free-text message to turn", () => {
    const result = normalizeDenisSignal({
      type: "message",
      text: "Zwei Cola bitte",
      tableToken: "abc123def456ghi789jkl012mno345pq",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.signal.route).toBe("turn");
    expect(result.signal.channel).toBe("chat");
  });

  it("routes cart telemetry to sense", () => {
    const result = normalizeDenisSignal({
      type: "telemetry",
      kind: "cart",
      tableToken: "abc123def456ghi789jkl012mno345pq",
      payload: { revision: 1 },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.signal.route).toBe("sense");
    expect(result.signal.senseChannel).toBe("telemetry.manual_cart");
  });

  it("routes browse telemetry to sense", () => {
    const result = normalizeDenisSignal({
      type: "telemetry",
      kind: "browse",
      tableToken: "abc123def456ghi789jkl012mno345pq",
      payload: {
        browseEvent: {
          action: "view_category",
          categoryId: "cat-food",
          categoryPath: ["food"],
          timestamp: "2026-06-07T16:40:00.000Z",
        },
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.signal.route).toBe("sense");
    expect(result.signal.senseChannel).toBe("telemetry.browse");
  });
});
