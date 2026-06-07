import type { GuestPredictedNeed } from "@/lib/denis/cognition/mental-model/mental-model-types";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import type { StaffProactiveAlert } from "@/lib/denis/cognition/proactive/proactive-types";

const WAITER_REQUEST_PATTERN =
  /\b(konobar|waiter|help|pomoc|pomoć|garson|kelner|kellner)\b/i;

const RECOMMENDATION_PATTERN =
  /\b(preporuk|recommend|empfehl|suggest|šta da|sta da|what should)\b/i;

const ALLERGY_PATTERN =
  /\b(alergij\w*|allerg\w*|intoleran\w*|bez\s+(glutena|laktoze|mleka|kikirikija|oraha))\b/i;

export function guestAskedForRecommendation(message: string): boolean {
  return RECOMMENDATION_PATTERN.test(message.trim());
}

export function detectAllergyMention(message: string): string | null {
  const trimmed = message.trim();
  if (!trimmed || !ALLERGY_PATTERN.test(trimmed)) return null;
  return trimmed.slice(0, 160);
}

export function detectWaiterRequest(message: string): boolean {
  return WAITER_REQUEST_PATTERN.test(message.trim());
}

export function detectStaffProactiveAlerts(input: {
  config: ConciergeConfig;
  tableName: string;
  idleMinutes: number;
  emittedKeys: string[];
  recentGuestMessages: string[];
  waiterEscalated: boolean;
  mentalPredictedNeed?: GuestPredictedNeed | null;
}): StaffProactiveAlert[] {
  const alerts: StaffProactiveAlert[] = [];
  const emitted = new Set(input.emittedKeys);

  if (
    input.config.proactive.staffTableIdle &&
    !emitted.has("staff_table_idle") &&
    input.idleMinutes >= input.config.proactive.staffTableIdleMinutes
  ) {
    alerts.push({
      kind: "staff_table_idle",
      tableName: input.tableName,
      message: `Sto ${input.tableName} čeka ${Math.floor(input.idleMinutes)} min — proveri`,
    });
  }

  if (input.config.proactive.staffWaiterRequest && !emitted.has("staff_waiter_request")) {
    const waiterMessage = input.recentGuestMessages.find((message) =>
      detectWaiterRequest(message)
    );
    if (waiterMessage || input.waiterEscalated) {
      alerts.push({
        kind: "staff_waiter_request",
        tableName: input.tableName,
        message: `Sto ${input.tableName} traži konobara`,
      });
    }
  }

  if (
    input.config.proactive.staffWaiterRequest &&
    !emitted.has("staff_attention_escalation") &&
    input.mentalPredictedNeed === "needs_attention"
  ) {
    alerts.push({
      kind: "staff_attention_escalation",
      tableName: input.tableName,
      message: `Sto ${input.tableName} — gost frustriran, potrebna pažnja konobara`,
    });
  }

  if (input.config.proactive.staffAllergy && !emitted.has("staff_allergy")) {
    for (const message of input.recentGuestMessages) {
      const allergy = detectAllergyMention(message);
      if (!allergy) continue;
      alerts.push({
        kind: "staff_allergy",
        tableName: input.tableName,
        message: `Sto ${input.tableName} — ALERGIJA: ${allergy}. Pazi kod pripreme.`,
        detail: allergy,
      });
      break;
    }
  }

  return alerts;
}
