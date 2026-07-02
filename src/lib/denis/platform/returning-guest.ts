/**
 * ADR-043 S11 — returning guest recognition (stalni gost).
 * Whitelist memory: favorites, allergies, language — device token only.
 */
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import type { GuestMemoryProjection } from "@/lib/denis/platform/guest-memory-types";
import { guestMemoryPersonalizationAllowed } from "@/lib/denis/platform/guest-memory-format";

const CHIP_LABEL_MAX = 20;

function clipChipLabel(label: string): string {
  const trimmed = label.trim();
  if (trimmed.length <= CHIP_LABEL_MAX) return trimmed;
  return trimmed.slice(0, CHIP_LABEL_MAX).trimEnd();
}

function isReturningGuestMemory(
  memory: GuestMemoryProjection | null | undefined
): boolean {
  return (memory?.visitCount ?? 0) >= 2;
}

/** Past orders exist — required for "kao i obično" chip (not just visit count). */
export function returnGuestHasPastOrders(
  memory: GuestMemoryProjection | null | undefined
): boolean {
  if (!memory) return false;
  if ((memory.favoriteProductIds?.length ?? 0) > 0) return true;
  if ((memory.lastVisitItemNames?.length ?? 0) > 0) return true;
  if ((memory.favoriteItems?.length ?? 0) > 0) return true;
  return false;
}

export function resolveReturnGuestTopItem(
  memory: GuestMemoryProjection | null | undefined
): string | null {
  if (!memory) return null;
  const top =
    memory.favoriteItems?.[0] ??
    memory.lastVisitItemNames?.[0] ??
    null;
  return top?.trim() ? top.trim() : null;
}

/** Welcome + same-again only when feature enabled, consented, and returning with history. */
export function shouldEmitReturnGuestWelcome(input: {
  config: ConciergeConfig;
  memory: GuestMemoryProjection | null | undefined;
  flowNodeId?: string;
  topGoal?: string;
}): boolean {
  if (!input.config.memory.returnGuestEnabled) return false;
  if (input.flowNodeId !== "welcome") return false;
  if ((input.topGoal ?? "GUEST_SEATED") !== "GUEST_SEATED") return false;
  if (!input.memory || !guestMemoryPersonalizationAllowed(input.memory)) {
    return false;
  }
  if (!isReturningGuestMemory(input.memory)) return false;
  return returnGuestHasPastOrders(input.memory);
}

/** Skip "I have allergy" chip when allergens already stored from a prior visit. */
export function shouldSuppressAllergyPromptChip(
  memory: GuestMemoryProjection | null | undefined
): boolean {
  if (!memory || !guestMemoryPersonalizationAllowed(memory)) return false;
  return (memory.allergyLabels?.length ?? 0) > 0;
}

export function buildSameAgainChipLabel(
  language: string,
  topItem?: string | null
): string {
  const lang = language.toLowerCase().slice(0, 2);
  const item = topItem?.trim();
  if (item) {
    if (lang === "de") return clipChipLabel(`Wieder ${item}?`);
    if (lang === "en") return clipChipLabel(`Usual — ${item}?`);
    return clipChipLabel(`Obično — ${item}?`);
  }
  if (lang === "de") return "Gleich nochmal";
  if (lang === "en") return "Same again";
  return "Kao i obično?";
}
