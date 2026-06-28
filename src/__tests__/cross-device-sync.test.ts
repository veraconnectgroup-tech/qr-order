import { describe, expect, it } from "vitest";
import {
  mergeDeviceCartSnapshots,
  resolveCrossDeviceSync,
  type DeviceContext,
} from "@/lib/denis/actor/cross-device-sync";

function device(
  fingerprint: string,
  cart: DeviceContext["cartSnapshot"],
  tail: string[] = []
): DeviceContext {
  return {
    fingerprint,
    lastActiveAt: Date.now(),
    conversationTail: tail,
    cartSnapshot: cart,
    language: "sr",
  };
}

describe("cross-device sync (U2)", () => {
  it("merges Burger from device A and Pivo from device B", () => {
    const devices = [
      device("device-a", [
        {
          productId: "p-burger",
          productName: "Burger",
          quantity: 1,
        },
      ]),
      device("device-b", [
        {
          productId: "p-pivo",
          productName: "Pivo",
          quantity: 1,
          serveSize: "0.5L",
        },
      ]),
    ];

    const merged = mergeDeviceCartSnapshots(devices);

    expect(merged).toHaveLength(2);
    expect(merged.map((line) => line.productName).sort()).toEqual([
      "Burger",
      "Pivo",
    ]);
  });

  it("shared_cart cart_updated emits sync_cart to peers", () => {
    const devices = [
      device("device-a", [{ productId: "1", productName: "Burger", quantity: 1 }]),
      device("device-b", []),
    ];

    const actions = resolveCrossDeviceSync(
      devices,
      "device-a",
      "cart_updated",
      "shared_cart"
    );

    expect(actions).toEqual([
      { action: "sync_cart", from: "device-a", to: "device-b" },
    ]);
  });

  it("per_device cart_updated does not sync carts", () => {
    const devices = [
      device("device-a", [{ productId: "1", productName: "Burger", quantity: 1 }]),
      device("device-b", []),
    ];

    const actions = resolveCrossDeviceSync(
      devices,
      "device-a",
      "cart_updated",
      "per_device"
    );

    expect(actions).toEqual([]);
  });

  it("order_placed notifies other devices", () => {
    const devices = [device("device-a", []), device("device-b", [])];

    const actions = resolveCrossDeviceSync(
      devices,
      "device-a",
      "order_placed",
      "shared_cart"
    );

    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ action: "notify_other_devices" });
  });

  it("message_sent merges conversation tails from all devices", () => {
    const devices = [
      device("device-a", [], ["Guest: Burger molim"]),
      device("device-b", [], ["Guest: I pivo"]),
    ];

    const actions = resolveCrossDeviceSync(
      devices,
      "device-b",
      "message_sent",
      "shared_cart"
    );

    const merge = actions.find((action) => action.action === "merge_context");
    expect(merge).toBeDefined();
    if (merge?.action === "merge_context") {
      expect(merge.combined.join(" ")).toMatch(/Burger/i);
      expect(merge.combined.join(" ")).toMatch(/pivo/i);
    }
  });
});
