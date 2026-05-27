import {
  emptyCartDraft,
  type DenisCartDraft,
  type DenisCartLine,
} from "@/lib/denis/kernel/cart-projection";
import { lineFingerprint, unitPrice } from "@/lib/denis/kernel/conflict/line-match";
import type { ManualCartSnapshot } from "@/lib/denis/runtime/adapters/map-legacy-draft";
import { manualSnapshotToDenisDraft } from "@/lib/denis/runtime/adapters/map-legacy-draft";
import type { PartyDeviceRow } from "@/lib/denis/venue/party/types";

function snapshotToDraft(snapshot: unknown): DenisCartDraft | undefined {
  if (!snapshot || typeof snapshot !== "object") return undefined;
  return manualSnapshotToDenisDraft(snapshot as ManualCartSnapshot);
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

/** Lines present in peer manual but not in local manual. */
export function peerOnlyManualLines(
  local: DenisCartDraft,
  peer: DenisCartDraft
): DenisCartLine[] {
  if (peer.items.length === 0) return [];
  const localFps = new Set(local.items.map((line) => lineFingerprint(line)));
  return peer.items.filter((line) => !localFps.has(lineFingerprint(line)));
}

/** Union local + peer manual for combined conflict check. */
export function combineManualDrafts(
  local: DenisCartDraft | undefined,
  peer: DenisCartDraft
): DenisCartDraft {
  const base = local ?? emptyCartDraft();
  if (peer.items.length === 0) return base;

  const merged = new Map<string, DenisCartLine>();
  for (const line of base.items) {
    merged.set(lineFingerprint(line), { ...line });
  }
  for (const line of peer.items) {
    const fp = lineFingerprint(line);
    const existing = merged.get(fp);
    if (!existing) {
      merged.set(fp, { ...line });
      continue;
    }
    const qty = Math.max(existing.quantity, line.quantity);
    const price = unitPrice(existing);
    merged.set(fp, {
      ...existing,
      quantity: qty,
      lineTotal: Number((price * qty).toFixed(2)),
    });
  }

  return {
    cartRevision: Math.max(base.cartRevision, 0),
    items: [...merged.values()],
  };
}
