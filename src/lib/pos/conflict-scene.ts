import type { ComposeSceneInput } from "@/lib/scene/types";

export type PosConflictSceneInput = {
  staffEditActive: boolean;
  cartConflict: boolean;
  language?: string;
};

const MESSAGES: Record<string, string> = {
  de: "Der Kellner bearbeitet gerade Ihre Bestellung — einen Moment bitte.",
  en: "Your waiter is updating your order right now — one moment please.",
  sr: "Konobar upravo menja vašu narudžbinu — samo trenutak.",
  hr: "Konobar upravo mijenja vašu narudžbinu — samo trenutak.",
};

/** Guest-facing blocking copy when POS/staff edits overlap guest cart changes. */
export function buildPosStaffEditBlockingMessage(language?: string): string {
  const lang = language?.trim().toLowerCase().slice(0, 2) ?? "sr";
  return MESSAGES[lang] ?? MESSAGES.sr!;
}

/** Scene blocking layer when guest and waiter edit the same table concurrently. */
export function resolvePosConflictBlocking(
  input: PosConflictSceneInput
): ComposeSceneInput["blocking"] {
  if (!input.staffEditActive && !input.cartConflict) return null;

  if (input.staffEditActive) {
    return {
      reason: "conflict",
      message: buildPosStaffEditBlockingMessage(input.language),
    };
  }

  return null;
}
