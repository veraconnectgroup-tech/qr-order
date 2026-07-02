import type {
  ConciergeServiceRecovery,
  ServiceRecoveryGesture,
} from "@/lib/denis/config/concierge-config.schema";
import type { ServiceRecoveryTrigger } from "@/lib/denis/cognition/recovery/detect-service-recovery";
import { guestTextFromTimeline } from "@/lib/denis/cognition/conversation/guest-continuity";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

export const SERVICE_RECOVERY_MESSAGE_PREFIX = "Recovery —";

const GESTURE_LABELS: Record<
  ServiceRecoveryGesture,
  Record<"sr" | "en" | "de", string>
> = {
  dessert_on_house: {
    sr: "desert na račun kuće",
    en: "dessert on the house",
    de: "Dessert aufs Haus",
  },
  drink_on_house: {
    sr: "piće na račun kuće",
    en: "drink on the house",
    de: "Getränk aufs Haus",
  },
  discount_10: {
    sr: "popust 10% (predlog)",
    en: "10% discount (suggestion)",
    de: "10 % Rabatt (Vorschlag)",
  },
};

function locale(language: string): "sr" | "en" | "de" {
  const lang = language.toLowerCase().slice(0, 2);
  if (lang === "de") return "de";
  if (lang === "en") return "en";
  return "sr";
}

export function suggestRecoveryGesture(
  config: ConciergeServiceRecovery,
  triggers: ServiceRecoveryTrigger[],
  language: string
): ServiceRecoveryGesture | null {
  const gestures = config.gestures ?? [];
  if (!gestures.length) return null;

  if (triggers.includes("guest_complaint") && gestures.includes("dessert_on_house")) {
    return "dessert_on_house";
  }
  if (triggers.includes("long_wait_silence") && gestures.includes("drink_on_house")) {
    return "drink_on_house";
  }
  if (triggers.includes("high_frustration") && gestures.includes("discount_10")) {
    return "discount_10";
  }

  return gestures[0] ?? null;
}

export function formatRecoveryGestureLabel(
  gesture: ServiceRecoveryGesture,
  language: string
): string {
  return GESTURE_LABELS[gesture][locale(language)];
}

export function extractRecentGuestMessages(
  timeline: DenisTimelineRow[],
  limit = 3
): string[] {
  const out: string[] = [];
  for (let index = timeline.length - 1; index >= 0 && out.length < limit; index -= 1) {
    const text = guestTextFromTimeline(timeline[index]!);
    if (text) out.unshift(text.slice(0, 100));
  }
  return out;
}

export function buildServiceRecoveryStaffMessage(input: {
  tableName: string;
  language: string;
  triggers: ServiceRecoveryTrigger[];
  complaintSnippet: string | null;
  waitMinutes: number | null;
  recentGuestMessages: string[];
  orderSummary: string | null;
  gesture: ServiceRecoveryGesture | null;
}): { message: string; detail: string } {
  const loc = locale(input.language);
  const triggerLine =
    loc === "de"
      ? `Signale: ${input.triggers.join(", ")}`
      : loc === "en"
        ? `Signals: ${input.triggers.join(", ")}`
        : `Signali: ${input.triggers.join(", ")}`;

  const lines = [
    `${SERVICE_RECOVERY_MESSAGE_PREFIX} ${input.tableName}`,
    triggerLine,
  ];

  if (input.complaintSnippet) {
    lines.push(`Gost: "${input.complaintSnippet}"`);
  } else if (input.recentGuestMessages.length) {
    lines.push(`Gost: "${input.recentGuestMessages[input.recentGuestMessages.length - 1]}"`);
  }

  if (input.waitMinutes != null) {
    lines.push(`Čeka: ~${input.waitMinutes} min`);
  }

  if (input.orderSummary) {
    lines.push(input.orderSummary);
  }

  if (input.gesture) {
    const label = formatRecoveryGestureLabel(input.gesture, input.language);
    lines.push(
      loc === "de"
        ? `Vorschlag: ${label} — nur Vorschlag, Manager entscheidet`
        : loc === "en"
          ? `Suggest: ${label} — suggestion only, manager decides`
          : `Predlog gesta: ${label} — SAMO predlog, menadžer odlučuje`
    );
  }

  const message = lines.slice(0, 4).join(" · ");
  return { message, detail: lines.join("\n") };
}

export function isServiceRecoveryNotificationMessage(message: string): boolean {
  return message.trimStart().startsWith(SERVICE_RECOVERY_MESSAGE_PREFIX);
}
