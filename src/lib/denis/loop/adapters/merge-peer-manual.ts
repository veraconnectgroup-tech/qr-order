import {
  emptyCartDraft,
  type DenisCartDraft,
  type DenisCartLine,
} from "@/lib/denis/kernel/cart-projection";
import { lineFingerprint, unitPrice } from "@/lib/denis/kernel/conflict/line-match";
import type { ManualCartSnapshotInput } from "@/lib/denis/platform/sense-types";
import type { PartyDeviceRow } from "@/lib/denis/venue/party/types";
import { manualSnapshotToDenisDraft } from "@/lib/denis/loop/adapters/map-cart-snapshot";

function snapshotToDraft(snapshot: unknown): DenisCartDraft | undefined {
  if (!snapshot || typeof snapshot !== "object") return undefined;
  return manualSnapshotToDenisDraft(snapshot as ManualCartSnapshotInput);
}

/** Merge peer device manual carts (excludes current device). */
export function mergePeerManualDraft(
  devices: PartyDeviceRow[],
  excludeFingerprint: string | null | undefined
): DenisCartDraft {
  const merged = new Map<string, DenisCartLine>();
  const exclude = excludeFingerprint?.trim().toLowerCase() ?? null;

  for (const device of devices) {
    if (exclude && device.deviceFingerprint.toLowerCase() === exclude) continue;
    const draft = snapshotToDraft(device.manualCartSnapshot);
    if (!draft?.items.length) continue;

    for (const line of draft.items) {
      const fp = lineFingerprint(line);
      const existing = merged.get(fp);
      if (!existing) {
        merged.set(fp, { ...line });
        continue;
      }
      const qty = existing.quantity + line.quantity;
      const price = unitPrice(existing);
      merged.set(fp, {
        ...existing,
        quantity: qty,
        lineTotal: Number((price * qty).toFixed(2)),
      });
    }
  }

  return {
    ...emptyCartDraft(),
    items: [...merged.values()],
  };
}
