import { describe, expect, it, vi } from "vitest";
import {
  buildAgenticLivePerceiveResponse,
  runAgenticLiveTurn,
} from "@/lib/denis/agentic/run-agentic-live-turn";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";

vi.mock("@/lib/denis/agentic/run-tool-loop", () => ({
  runToolLoop: vi.fn().mockResolvedValue({
    finalContent: "Kuhinja trenutno kasni oko 15 minuta.",
    rounds: [{ round: 1, toolCalls: [{ name: "check_kitchen_status", arguments: "{}", result: { known: true } }] }],
    hitRoundCap: false,
  }),
}));

describe("runAgenticLiveTurn", () => {
  it("returns tool-loop content for live perceive", async () => {
    const result = await runAgenticLiveTurn({
      admin: {} as never,
      ctx: {
        locationId: "loc-1",
        config: CONCIERGE_PLATFORM_DEFAULTS,
      } as never,
      body: {
        locationId: "loc-1",
        tableId: "table-1",
        sessionToken: "tok-12345678901234567890123456789012",
        sessionId: "sess-1",
        message: "Koliko čekam hranu?",
        language: "sr",
        preferences: { allergies: [], mood: "neutral" },
        includeOrderContext: false,
        allowOrdering: true,
      },
      evidence: {
        pointers: ["situation.pack"],
        evidenceBlock: "Kitchen backlog is high.",
        omitFullMenu: true,
        playbookBlock: null,
      },
      maxRounds: 3,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.message).toContain("15 minuta");
      expect(result.toolsCalled).toContain("check_kitchen_status");
    }
  });

  it("builds a structured perceive-compatible API response", async () => {
    const response = buildAgenticLivePerceiveResponse({
      message: "Kuhinja kasni.",
      sessionId: "sess-1",
      language: "sr",
    });
    const json = await response.json();
    expect(json.data.message).toBe("Kuhinja kasni.");
    expect(json.data.structuredPerception?.agenticLive).toBe(true);
  });
});
