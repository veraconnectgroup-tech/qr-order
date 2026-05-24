import { describe, expect, it } from "vitest";
import {
  TRACE_HEADER,
  getTraceId,
  runWithTraceId,
  traceMetadata,
} from "@/lib/resilience/trace";

describe("trace", () => {
  it("reuses incoming x-trace-id header", () => {
    const req = new Request("https://example.com/api/orders", {
      headers: { [TRACE_HEADER]: "abc-123" },
    });
    expect(getTraceId(req)).toBe("abc-123");
  });

  it("generates a trace id when header is missing", () => {
    const req = new Request("https://example.com/api/orders");
    const traceId = getTraceId(req);
    expect(traceId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it("propagates trace id through async local storage", () => {
    runWithTraceId("trace-xyz", () => {
      expect(traceMetadata({ orderId: "o1" })).toEqual({
        trace_id: "trace-xyz",
        orderId: "o1",
      });
    });
  });
});
