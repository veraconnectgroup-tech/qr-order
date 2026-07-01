import type { ManualCartSnapshotInput } from "@/lib/denis/platform/sense-types";
import type { PartyDeviceRow } from "@/lib/denis/venue/party/types";

export type PartyDeviceCartLine = {
  productId: string;
  productName: string;
  quantity: number;
  serveSize?: string | null;
};

export type PartyDeviceContext = {
  fingerprint: string;
  lastActiveAt: number;
  conversationTail: string[];
  cartSnapshot: PartyDeviceCartLine[];
  language: string;
};

function snapshotToCartLines(snapshot: unknown): PartyDeviceCartLine[] {
  if (!snapshot || typeof snapshot !== "object") return [];
  const parsed = snapshot as ManualCartSnapshotInput;
  if (!Array.isArray(parsed.items)) return [];

  return parsed.items.map((item) => ({
    productId: item.productId,
    productName: item.productName,
    quantity: item.quantity,
    serveSize: item.serveSize,
  }));
}

export function buildDeviceContextsFromParty(input: {
  devices: PartyDeviceRow[];
  conversationTailByDevice?: Record<string, string[]>;
  language?: string;
}): PartyDeviceContext[] {
  const language = input.language ?? "sr";

  return input.devices.map((device) => ({
    fingerprint: device.deviceFingerprint,
    lastActiveAt: Date.parse(device.lastActiveAt) || Date.now(),
    conversationTail:
      input.conversationTailByDevice?.[device.deviceFingerprint] ?? [],
    cartSnapshot: snapshotToCartLines(device.manualCartSnapshot),
    language,
  }));
}
