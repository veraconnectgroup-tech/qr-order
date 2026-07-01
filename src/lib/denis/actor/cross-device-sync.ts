/** Cart line for cross-device merge (actor-local — no layer imports). */
export type CartLine = {
  productId: string;
  productName: string;
  quantity: number;
  serveSize?: string | null;
};

export type DeviceContext = {
  fingerprint: string;
  lastActiveAt: number;
  conversationTail: string[];
  cartSnapshot: CartLine[];
  language: string;
};

export type CrossDeviceSyncEvent =
  | "order_placed"
  | "cart_updated"
  | "message_sent";

export type CrossDeviceSyncAction =
  | { action: "sync_cart"; from: string; to: string }
  | { action: "notify_other_devices"; message: string }
  | { action: "merge_context"; combined: string[] };

function cartLineKey(line: CartLine): string {
  const size = line.serveSize?.trim().toLowerCase() ?? "";
  return `${line.productId}:${size}`;
}

/** Merge cart lines from multiple devices without losing quantities. */
export function mergeDeviceCartSnapshots(
  devices: DeviceContext[]
): CartLine[] {
  const merged = new Map<string, CartLine>();

  for (const device of devices) {
    for (const line of device.cartSnapshot) {
      const key = cartLineKey(line);
      const existing = merged.get(key);
      if (!existing) {
        merged.set(key, { ...line });
        continue;
      }
      merged.set(key, {
        ...existing,
        quantity: existing.quantity + line.quantity,
      });
    }
  }

  return [...merged.values()];
}

function otherDevices(
  devices: DeviceContext[],
  currentDevice: string
): DeviceContext[] {
  const current = currentDevice.trim().toLowerCase();
  return devices.filter(
    (device) => device.fingerprint.trim().toLowerCase() !== current
  );
}

function mergeConversationTails(devices: DeviceContext[]): string[] {
  const tagged = devices.flatMap((device) =>
    device.conversationTail.map((line) => ({
      at: device.lastActiveAt,
      line: `[${device.fingerprint.slice(0, 6)}] ${line}`,
    }))
  );

  tagged.sort((a, b) => a.at - b.at);
  const seen = new Set<string>();
  const combined: string[] = [];

  for (const entry of tagged) {
    const key = entry.line.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    combined.push(entry.line);
  }

  return combined.slice(-9);
}

/**
 * Resolve cross-device sync actions for a table party event.
 * Cart sync applies only in shared_cart mode; per_device keeps carts isolated.
 */
export function resolveCrossDeviceSync(
  devices: DeviceContext[],
  currentDevice: string,
  event: CrossDeviceSyncEvent,
  partyMode: "shared_cart" | "per_device" = "shared_cart"
): CrossDeviceSyncAction[] {
  if (devices.length <= 1) return [];

  const peers = otherDevices(devices, currentDevice);
  if (peers.length === 0) return [];

  const actions: CrossDeviceSyncAction[] = [];

  switch (event) {
    case "order_placed":
      actions.push({
        action: "notify_other_devices",
        message: "Porudžbina je poslata — status se ažurira na svim uređajima.",
      });
      break;

    case "cart_updated":
      if (partyMode === "shared_cart") {
        for (const peer of peers) {
          actions.push({
            action: "sync_cart",
            from: currentDevice,
            to: peer.fingerprint,
          });
        }
      }
      break;

    case "message_sent": {
      const combined = mergeConversationTails(devices);
      if (combined.length > 0) {
        actions.push({ action: "merge_context", combined });
      }
      break;
    }

    default:
      break;
  }

  return actions;
}

/** Situation Pack block for merged multi-device dialogue context. */
export function formatCrossDeviceContextBlock(
  combined: string[]
): string | null {
  if (combined.length === 0) return null;

  return [
    "CROSS-DEVICE CONTEXT (shared table — continue thread):",
    ...combined.map((line) => `- ${line}`),
  ].join("\n");
}
