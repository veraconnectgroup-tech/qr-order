import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";
import type { GuestMemoryProjection } from "@/lib/denis/platform/guest-memory-types";
import {
  DEFAULT_GUEST_ACCESSIBILITY,
  decodeAccessibilityFromModifiers,
  mergeAccessibilityPrefs,
  type ClientAccessibilitySignals,
  type GuestAccessibilityPrefs,
} from "@/lib/denis/cognition/mental-model/accessibility-types";

const INCREASE_TEXT_PATTERN =
  /\b(pove[cć]aj\s+tekst|ve[cć]i\s+font|ve[lł]iki\s+tekst|larger\s+text|bigger\s+font|gr[oö][ßs]er)\b/i;

const LOW_VISION_PATTERN =
  /\b(ne\s+vidim|slabo\s+vidim|slabovid|can't\s+see|cannot\s+see|schlecht\s+sehen)\b/i;

const SIMPLIFY_PATTERN =
  /\b(jednostavnij|pojednostavi|simpler|einfacher|easy\s+mode)\b/i;

function voiceUsedOnTimeline(timeline: DenisTimelineRow[]): boolean {
  for (const event of timeline) {
    const payload = event.payload;
    if (!payload || typeof payload !== "object") continue;
    const frame = (payload as Record<string, unknown>).frame;
    if (!frame || typeof frame !== "object") continue;
    const channel = (frame as Record<string, unknown>).channel;
    if (channel === "voice.transcript" || channel === "voice.tts") {
      return true;
    }
  }
  return false;
}

function accessibilityFromGuestMessage(
  message: string | null | undefined
): Partial<GuestAccessibilityPrefs> | null {
  if (!message?.trim()) return null;
  const patch: Partial<GuestAccessibilityPrefs> = {};

  if (INCREASE_TEXT_PATTERN.test(message) || LOW_VISION_PATTERN.test(message)) {
    patch.fontScale = 1.5;
    patch.highContrast = true;
  }
  if (SIMPLIFY_PATTERN.test(message)) {
    patch.preferredMode = "simplified";
    patch.fontScale = Math.max(patch.fontScale ?? 1, 1.25);
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

function accessibilityFromClientSignals(
  signals: ClientAccessibilitySignals | null | undefined
): Partial<GuestAccessibilityPrefs> | null {
  if (!signals) return null;
  const patch: Partial<GuestAccessibilityPrefs> = {};

  if (signals.screenReader) {
    patch.preferredMode = "simplified";
    patch.highContrast = true;
    patch.fontScale = Math.max(patch.fontScale ?? 1, 1.25);
  }
  if (signals.voiceInput) {
    patch.preferredMode = "voice";
  }
  if (typeof signals.browserZoom === "number" && signals.browserZoom >= 1.5) {
    patch.fontScale = 1.5;
    patch.highContrast = patch.highContrast ?? true;
  }
  if (signals.prefersReducedMotion) {
    patch.reducedMotion = true;
  }
  if (signals.coarsePointer) {
    patch.fontScale = Math.max(patch.fontScale ?? 1, 1.25);
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

function accessibilityFromGuestMemory(
  memory: GuestMemoryProjection | null | undefined
): GuestAccessibilityPrefs | null {
  if (!memory) return null;
  return decodeAccessibilityFromModifiers(memory.modifierPreferences);
}

function accessibilityForReturningGuest(
  memory: GuestMemoryProjection | null | undefined
): Partial<GuestAccessibilityPrefs> | null {
  if (!memory || memory.visitCount < 4) return null;
  const stored = decodeAccessibilityFromModifiers(memory.modifierPreferences);
  if (stored && stored.fontScale > 1) return stored;

  if (
    memory.avgSessionMinutes != null &&
    memory.avgSessionMinutes >= 50 &&
    memory.visitCount >= 5
  ) {
    return { fontScale: 1.25 };
  }

  return null;
}

/** Deterministic accessibility fold — no LLM. */
export function deriveGuestAccessibility(input: {
  timeline: DenisTimelineRow[];
  guestMessage?: string | null;
  clientSignals?: ClientAccessibilitySignals | null;
  guestMemory?: GuestMemoryProjection | null;
  previous?: GuestAccessibilityPrefs | null;
  inputSurface?: "chat" | "voice";
}): GuestAccessibilityPrefs {
  let prefs = mergeAccessibilityPrefs(
    DEFAULT_GUEST_ACCESSIBILITY,
    input.previous ?? accessibilityFromGuestMemory(input.guestMemory)
  );

  prefs = mergeAccessibilityPrefs(
    prefs,
    accessibilityForReturningGuest(input.guestMemory)
  );

  if (input.inputSurface === "voice" || voiceUsedOnTimeline(input.timeline)) {
    prefs = mergeAccessibilityPrefs(prefs, { preferredMode: "voice" });
  }

  prefs = mergeAccessibilityPrefs(
    prefs,
    accessibilityFromClientSignals(input.clientSignals)
  );
  prefs = mergeAccessibilityPrefs(
    prefs,
    accessibilityFromGuestMessage(input.guestMessage)
  );

  return prefs;
}

/** Situation pack directive for simplified / voice modes. */
export function buildAccessibilityEvidenceBlock(
  prefs: GuestAccessibilityPrefs
): string | null {
  const scene = prefs.preferredMode === "default" &&
    prefs.fontScale <= 1 &&
    !prefs.highContrast
    ? null
    : prefs;

  if (!scene) return null;

  const lines = ["ACCESSIBILITY (guest UI adapted — follow reply limits):"];

  if (scene.preferredMode === "voice") {
    lines.push("- Voice mode: keep replies speakable; max 2 short sentences.");
  }
  if (scene.preferredMode === "simplified") {
    lines.push("- Simplified UI: max 2 sentences, no upsell fluff.");
  }
  if (scene.fontScale >= 1.25) {
    lines.push(`- Large text active (scale ${scene.fontScale}).`);
  }
  if (scene.highContrast) {
    lines.push("- High contrast active — clear, direct wording.");
  }
  if (scene.reducedMotion) {
    lines.push("- Reduced motion — avoid animated phrasing.");
  }

  return lines.join("\n");
}

const ESSENTIAL_LAYER_KINDS = [
  "blocking",
  "sheet",
  "banner",
  "chips",
] as const;

export function filterEssentialSceneLayers<T extends { kind: string }>(
  layers: T[],
  prefs: GuestAccessibilityPrefs | null | undefined
): T[] {
  if (!prefs || prefs.preferredMode !== "simplified") return layers;
  return layers.filter((layer) =>
    (ESSENTIAL_LAYER_KINDS as readonly string[]).includes(layer.kind)
  );
}
