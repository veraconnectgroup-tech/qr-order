import { describe, expect, it } from "vitest";
import { buildPerDeviceSplitPlan } from "@/lib/denis/venue/party/build-per-device-split";

describe("buildPerDeviceSplitPlan", () => {
  it("groups order items by device fingerprint", () => {
    const plan = buildPerDeviceSplitPlan({
      items: [
        {
          id: "i1",
          product_name: "Burger",
          total: 12,
          device_fingerprint: "dev-a",
        },
        {
          id: "i2",
          product_name: "Pivo",
          total: 4,
          device_fingerprint: "dev-b",
        },
      ],
      devices: [
        { deviceFingerprint: "dev-a", displayName: "Guest A" },
        { deviceFingerprint: "dev-b", displayName: "Guest B" },
      ],
    });

    expect(plan?.mode).toBe("by_device");
    expect(plan?.groups).toHaveLength(2);
    expect(plan?.groups[0]?.label).toBe("Guest A");
  });
});
