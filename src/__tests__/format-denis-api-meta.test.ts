import { describe, expect, it } from "vitest";
import { formatDenisApiMeta } from "@/lib/denis/surfaces/format-denis-api-meta";

describe("formatDenisApiMeta F9", () => {
  it("exposes act submit fields for guest client", () => {
    const meta = formatDenisApiMeta({
      traceId: "tr-1",
      channel: "chat",
      flowNodeId: "collect",
      topGoal: "SUBMIT_ORDER",
      conflictPrompt: null,
      actSubmitLive: true,
      actSubmitAttempted: true,
      actOrderNumber: 12,
    });

    expect(meta.actSubmitLive).toBe(true);
    expect(meta.actSubmitAttempted).toBe(true);
    expect(meta.actOrderNumber).toBe(12);
  });
});
