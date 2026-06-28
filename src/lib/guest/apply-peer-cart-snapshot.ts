import type { CartItem } from "@/hooks/use-cart";
import type { GuestManualCartSnapshot } from "@/lib/guest/manual-cart-snapshot";
import {
  mergeDeviceCartSnapshots,
  type CartLine,
  type DeviceContext,
} from "@/lib/denis/actor/cross-device-sync";

function snapshotToCartLines(snapshot: GuestManualCartSnapshot): CartLine[] {
  return snapshot.items.map((item) => ({
    productId: item.productId,
    productName: item.productName,
    quantity: item.quantity,
    serveSize: item.serveSize,
  }));
}

function cartLineKey(line: CartLine): string {
  const size = line.serveSize?.trim().toLowerCase() ?? "";
  return `${line.productId}:${size}`;
}

function existingCartLineKey(item: CartItem): string {
  const size = item.serveSize?.trim().toLowerCase() ?? "";
  return `${item.productId}:${size}`;
}

/** Merge peer party cart snapshots into the current guest cart (shared_cart mode). */
export function mergePeerCartIntoLocal(
  localItems: CartItem[],
  peerSnapshots: Array<{
    deviceFingerprint: string;
    snapshot: GuestManualCartSnapshot | null;
  }>,
  currentDeviceFingerprint: string
): CartItem[] {
  const devices: DeviceContext[] = [
    {
      fingerprint: currentDeviceFingerprint,
      lastActiveAt: Date.now(),
      conversationTail: [],
      cartSnapshot: localItems.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        serveSize: item.serveSize,
      })),
      language: "sr",
    },
    ...peerSnapshots
      .filter(
        (peer) =>
          peer.deviceFingerprint.toLowerCase() !==
          currentDeviceFingerprint.toLowerCase()
      )
      .map((peer) => ({
        fingerprint: peer.deviceFingerprint,
        lastActiveAt: Date.parse(peer.snapshot?.updatedAt ?? "") || Date.now(),
        conversationTail: [] as string[],
        cartSnapshot: peer.snapshot ? snapshotToCartLines(peer.snapshot) : [],
        language: "sr",
      })),
  ];

  const mergedLines = mergeDeviceCartSnapshots(devices);
  const localByKey = new Map(
    localItems.map((item) => [existingCartLineKey(item), item] as const)
  );

  return mergedLines.map((line) => {
    const key = cartLineKey(line);
    const existing = localByKey.get(key);
    if (existing) {
      return {
        ...existing,
        quantity: line.quantity,
        itemTotal: Number(
          (
            (existing.unitPrice +
              existing.modifiers.reduce((sum, mod) => sum + mod.price, 0)) *
            line.quantity
          ).toFixed(2)
        ),
      };
    }

    const unitPrice = line.quantity > 0 ? 0 : 0;
    return {
      productId: line.productId,
      productName: line.productName,
      unitPrice,
      quantity: line.quantity,
      notes: "",
      serveSize: line.serveSize ?? null,
      modifiers: [],
      itemTotal: 0,
    };
  });
}

export function peerCartRevisionChanged(
  previous: number | null,
  next: number | null
): boolean {
  return previous != null && next != null && previous !== next;
}
