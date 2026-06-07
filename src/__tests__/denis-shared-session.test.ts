import { describe, expect, it } from "vitest";
import { resolveCanonicalChatAiSessionId } from "@/lib/denis/venue/party";

describe("resolveCanonicalChatAiSessionId", () => {
  it("prefers shared session in shared_cart mode", () => {
    expect(
      resolveCanonicalChatAiSessionId(
        "shared_cart",
        "shared-session-id",
        "device-session-id"
      )
    ).toBe("shared-session-id");
  });

  it("keeps device session in per_device mode", () => {
    expect(
      resolveCanonicalChatAiSessionId(
        "per_device",
        "shared-session-id",
        "device-session-id"
      )
    ).toBe("device-session-id");
  });

  it("falls back to draft when client has no session", () => {
    expect(
      resolveCanonicalChatAiSessionId("shared_cart", "shared-session-id", undefined)
    ).toBe("shared-session-id");
  });
});
