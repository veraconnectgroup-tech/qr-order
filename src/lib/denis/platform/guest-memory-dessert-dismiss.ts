import type {
  GuestMemoryProjection,
  GuestMemorySyncPayload,
} from "@/lib/denis/platform/guest-memory-types";

const DESSERT_SKIP_THRESHOLD = 3;

export function isDessertNudgeDismissKey(key: string): boolean {
  const trimmed = key.trim();
  return trimmed === "dessert_nudge" || trimmed.startsWith("dessert_nudge:");
}

/** Patch guest memory after dessert nudge dismiss (J2 banner learning). */
export function computeDessertNudgeDismissPatch(input: {
  memory: GuestMemoryProjection;
}): GuestMemorySyncPayload | null {
  if (input.memory.skipDessertNudge) return null;

  const nextCount = (input.memory.dessertNudgeDismissCount ?? 0) + 1;
  return {
    dessertNudgeDismissCount: nextCount,
    skipDessertNudge: nextCount >= DESSERT_SKIP_THRESHOLD,
  };
}

export function dismissedKeysIncludeDessert(keys: string[] | undefined): boolean {
  if (!keys?.length) return false;
  return keys.some(isDessertNudgeDismissKey);
}
