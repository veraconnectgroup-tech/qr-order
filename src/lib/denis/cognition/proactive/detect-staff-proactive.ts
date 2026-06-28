import type { GuestAffect } from "@/lib/denis/cognition/mental-model/mental-model-types";
import {
  detectMultiTableDelayAlert,
  detectLowExperienceStaffAlert,
  type KitchenTableWait,
} from "@/lib/denis/cognition/proactive/triggers";
import { detectPreorderKitchenHeadsUp } from "@/lib/denis/cognition/proactive/kitchen-mind-triggers";
import { buildPreorderKitchenHeadsUpMessage } from "@/lib/denis/cognition/proactive/proactive-message-builders";
import {
  detectStornoCopilotSignal,
  formatStornoCopilotMessage,
  type StornoCopilotOrderContext,
} from "@/lib/fiscal/storno-copilot";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import type { StaffProactiveAlert } from "@/lib/denis/cognition/proactive/proactive-types";
import {
  isGuestHandoffMessage,
  isGuestVagueBrowseMessage,
} from "@/lib/denis/cognition/tde/semantic-intent-router";

const ALLERGY_PATTERN =
  /\b(alergij\w*|allerg\w*|intoleran\w*|bez\s+(glutena|laktoze|mleka|kikirikija|oraha))\b/i;

/** Guest messages before kitchen escalation (no order submitted). */
export const STAFF_ATTENTION_GUEST_MESSAGE_MIN = 3;

export function guestAskedForRecommendation(message: string): boolean {
  return isGuestVagueBrowseMessage(message.trim());
}

export function detectAllergyMention(message: string): string | null {
  const trimmed = message.trim();
  if (!trimmed || !ALLERGY_PATTERN.test(trimmed)) return null;
  return trimmed.slice(0, 160);
}

export function detectWaiterRequest(message: string): boolean {
  return isGuestHandoffMessage(message.trim());
}

export function isGuestFrustrated(affect: GuestAffect | null | undefined): boolean {
  const level = affect?.frustration.level ?? "none";
  return level === "mild" || level === "high";
}

export function detectStaffProactiveAlerts(input: {
  config: ConciergeConfig;
  tableName: string;
  idleMinutes: number;
  hasSessionOrders?: boolean;
  guestMessageCount?: number;
  hasKitchenResponse?: boolean;
  emittedKeys: string[];
  recentGuestMessages: string[];
  waiterEscalated: boolean;
  guestAffect?: GuestAffect | null;
  kitchenTableWaits?: KitchenTableWait[];
  browseMinutes?: number;
  partySize?: number;
  experienceScore?: number | null;
  language?: string | null;
  sessionOrder?: StornoCopilotOrderContext | null;
}): StaffProactiveAlert[] {
  const alerts: StaffProactiveAlert[] = [];
  const emitted = new Set(input.emittedKeys);
  const hasSessionOrders = input.hasSessionOrders ?? false;
  const guestMessageCount = input.guestMessageCount ?? 0;
  const hasKitchenResponse = input.hasKitchenResponse ?? false;

  if (
    input.config.proactive.staffTableIdle &&
    !emitted.has("staff_table_idle") &&
    !hasSessionOrders &&
    input.idleMinutes >= input.config.proactive.staffTableIdleMinutes
  ) {
    alerts.push({
      kind: "staff_table_idle",
      tableName: input.tableName,
      message: `Sto ${input.tableName} — ${Math.floor(input.idleMinutes)} min bez narudžbine`,
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
        message: `Sto ${input.tableName} traži konobara (Pozovi)`,
      });
    }
  }

  if (
    input.config.proactive.staffWaiterRequest &&
    !emitted.has("staff_attention_escalation") &&
    guestMessageCount >= STAFF_ATTENTION_GUEST_MESSAGE_MIN &&
    !hasKitchenResponse
  ) {
    alerts.push({
      kind: "staff_attention_escalation",
      tableName: input.tableName,
      message: `HITNO — Sto ${input.tableName}: ${guestMessageCount}+ poruka gosta, nema odgovora kuhinje`,
    });
  }

  if (
    input.config.proactive.staffWaiterRequest &&
    !emitted.has("staff_frustrated_guest") &&
    isGuestFrustrated(input.guestAffect)
  ) {
    alerts.push({
      kind: "staff_frustrated_guest",
      tableName: input.tableName,
      message: `Pređi na sto ${input.tableName}`,
      detail:
        input.guestAffect?.frustration.signals.join(", ") || "Gost frustriran",
    });
  }

  if (
    input.experienceScore != null &&
    !emitted.has("staff_low_experience")
  ) {
    const lowExperience = detectLowExperienceStaffAlert({
      tableName: input.tableName,
      experienceScore: input.experienceScore,
      language: input.language,
      isShown: () => emitted.has("staff_low_experience"),
    });
    if (lowExperience) {
      alerts.push(lowExperience);
    }
  }

  if (input.config.proactive.staffAllergy && !emitted.has("staff_allergy")) {
    for (const message of input.recentGuestMessages) {
      const allergy = detectAllergyMention(message);
      if (!allergy) continue;
      alerts.push({
        kind: "staff_allergy",
        tableName: input.tableName,
        message: `ALLERGY ALERT — Sto ${input.tableName}: ${allergy}`,
        detail: allergy,
      });
      break;
    }
  }

  if (!emitted.has("staff_storno_suggestion") && input.sessionOrder) {
    const stornoSignal = detectStornoCopilotSignal({
      recentGuestMessages: input.recentGuestMessages,
      sessionOrder: input.sessionOrder,
      guestFrustrated: isGuestFrustrated(input.guestAffect),
    });
    if (stornoSignal) {
      alerts.push({
        kind: "staff_storno_suggestion",
        tableName: input.tableName,
        message: formatStornoCopilotMessage(stornoSignal, input.tableName),
        detail: stornoSignal.reason,
      });
    }
  }

  if (
    input.config.proactive.slowKitchen &&
    !emitted.has("staff_multi_table_delay") &&
    !emitted.has("staff_kitchen_delay") &&
    input.kitchenTableWaits?.length
  ) {
    const escalation = detectMultiTableDelayAlert(input.kitchenTableWaits);
    if (escalation) {
      alerts.push({
        kind: "staff_multi_table_delay",
        tableName: input.tableName,
        message: escalation.message,
        detail: escalation.delayedTables.map((t) => t.tableName).join(", "),
      });
    }
  }

  const headsUp = detectPreorderKitchenHeadsUp({
    browseMinutes: input.browseMinutes ?? 0,
    partySize: input.partySize ?? 0,
    hasSessionOrders: input.hasSessionOrders ?? false,
    tableName: input.tableName,
    isShown: () => emitted.has("staff_preorder_heads_up"),
  });
  if (headsUp) {
    alerts.push({
      kind: "staff_preorder_heads_up",
      tableName: input.tableName,
      message: buildPreorderKitchenHeadsUpMessage({
        tableName: headsUp.tableName ?? input.tableName,
        partySize: headsUp.partySize ?? 0,
      }),
      detail: headsUp.prompt,
    });
  }

  return alerts;
}

export function actionUrlForStaffProactiveAlert(input: {
  kind: StaffProactiveAlert["kind"];
  tableId?: string;
}): string {
  switch (input.kind) {
    case "staff_allergy":
      return "/kitchen";
    case "staff_waiter_request":
    case "staff_attention_escalation":
      return "/waiter/calls";
    case "staff_frustrated_guest":
    case "staff_low_experience":
    case "staff_storno_suggestion":
    case "staff_table_idle":
      return input.tableId ? `/waiter/tables/${input.tableId}` : "/waiter";
    case "staff_kitchen_delay":
    case "staff_multi_table_delay":
      return "/kitchen";
    default:
      return "/dashboard";
  }
}

export function priorityForStaffProactiveAlert(
  kind: StaffProactiveAlert["kind"]
): "low" | "medium" | "high" | "urgent" {
  switch (kind) {
    case "staff_allergy":
    case "staff_attention_escalation":
      return "urgent";
    case "staff_frustrated_guest":
    case "staff_low_experience":
      return "high";
    case "staff_storno_suggestion":
      return "high";
    case "staff_waiter_request":
      return "medium";
    case "staff_table_idle":
      return "medium";
    default:
      return "high";
  }
}

export function shouldPlayStaffAlertSound(
  kind: StaffProactiveAlert["kind"]
): boolean {
  return (
    kind === "staff_waiter_request" ||
    kind === "staff_attention_escalation" ||
    kind === "staff_allergy" ||
    kind === "staff_frustrated_guest" ||
    kind === "staff_low_experience"
  );
}
