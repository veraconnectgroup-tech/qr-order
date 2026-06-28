import type { GuestAffect } from "@/lib/denis/cognition/mental-model/mental-model-types";
import { resolveTemplateLocale } from "@/lib/denis/cognition/tde/template-utterance";
import type { SessionPhase } from "@/lib/scene/types";

export type RecoveryAction =
  | { kind: "empathy_reply"; message: string }
  | { kind: "staff_escalation"; urgency: "normal" | "urgent"; reason: string }
  | { kind: "tone_adjustment"; style: "extra_apologetic" | "concise_only" };

/** Order posture for recovery (ADR Layer 3 / A3). */
export type OrderLifecycleBeliefs = {
  isWaiting: boolean;
  hasOpenOrders: boolean;
};

const EMPATHY_WAITING: Record<"sr" | "de" | "en", string> = {
  sr: "Znam da čekate — provjeravam status vaše narudžbe.",
  de: "Ich verstehe — ich prüfe gerade den Status Ihrer Bestellung.",
  en: "I know you're waiting — I'm checking on your order status.",
};

const EMPATHY_NO_ORDERS: Record<"sr" | "de" | "en", string> = {
  sr: "Izvinite zbog čekanja — mogu pomoći s narudžbom?",
  de: "Entschuldigung für die Wartezeit — soll ich bei der Bestellung helfen?",
  en: "Sorry for the wait — can I help you place an order?",
};

const EMPATHY_NEGATIVE: Record<"sr" | "de" | "en", string> = {
  sr: "Žao mi je što iskustvo nije idealno — tu sam da pomognem.",
  de: "Es tut mir leid, dass es nicht ideal läuft — ich helfe Ihnen gern.",
  en: "I'm sorry this hasn't gone smoothly — I'm here to help.",
};

export function deriveOrderLifecycleBeliefs(input: {
  sessionPhase?: SessionPhase | null;
  hasOpenKitchenOrders?: boolean;
  hasAnyOrders?: boolean;
}): OrderLifecycleBeliefs {
  const isWaiting =
    input.sessionPhase === "waiting" || Boolean(input.hasOpenKitchenOrders);
  const hasOpenOrders =
    Boolean(input.hasOpenKitchenOrders) || Boolean(input.hasAnyOrders);

  return { isWaiting, hasOpenOrders };
}

function toneDirective(style: RecoveryAction & { kind: "tone_adjustment" }): string {
  if (style.style === "concise_only") {
    return "FRUSTRATION RECOVERY: Budi kratak i konkretan, bez upsell-a.";
  }
  return "FRUSTRATION RECOVERY: Budi izuzetno empatičan, bez obećanja ETA koje ne znaš.";
}

/** Build situation-pack block from planned recovery actions. */
export function buildFrustrationRecoveryEvidence(
  actions: RecoveryAction[]
): string | null {
  const lines: string[] = [];

  for (const action of actions) {
    switch (action.kind) {
      case "empathy_reply":
        lines.push(`EMPATHY (say this naturally — do not invent ETA): ${action.message}`);
        break;
      case "tone_adjustment":
        lines.push(toneDirective(action));
        break;
      case "staff_escalation":
        lines.push(
          `STAFF ESCALATION (${action.urgency}): ${action.reason} — guest already notified staff is informed.`
        );
        break;
      default:
        break;
    }
  }

  if (lines.length === 0) return null;
  return ["FRUSTRATION RECOVERY:", ...lines.map((line) => `- ${line}`)].join("\n");
}

export function resolveFrustrationToneDirective(
  actions: RecoveryAction[]
): string | null {
  const tone = actions.find(
    (action): action is RecoveryAction & { kind: "tone_adjustment" } =>
      action.kind === "tone_adjustment"
  );
  return tone ? toneDirective(tone) : null;
}

export function resolveFrustrationEmpathyMessage(
  actions: RecoveryAction[]
): string | null {
  const empathy = actions.find(
    (action): action is RecoveryAction & { kind: "empathy_reply" } =>
      action.kind === "empathy_reply"
  );
  return empathy?.message ?? null;
}

export function resolveFrustrationStaffEscalation(
  actions: RecoveryAction[]
): (RecoveryAction & { kind: "staff_escalation" }) | null {
  return (
    actions.find(
      (action): action is RecoveryAction & { kind: "staff_escalation" } =>
        action.kind === "staff_escalation"
    ) ?? null
  );
}

/**
 * Plan reactive recovery when guest affect signals frustration (Layer 3 I1).
 * Empathy never invents ETA — use "provjeravam" not "uskoro stiže".
 */
export function planFrustrationRecovery(input: {
  affect: GuestAffect;
  orderLifecycle: OrderLifecycleBeliefs | null;
  staffOnFloor: boolean;
  language: string;
}): RecoveryAction[] {
  const level = input.affect.frustration.level;
  const sentiment = input.affect.sentiment.score;
  const waiting = input.orderLifecycle?.isWaiting ?? false;
  const hasOrders = input.orderLifecycle?.hasOpenOrders ?? false;
  const locale = resolveTemplateLocale(input.language);

  if (level === "none" && sentiment >= -0.5) {
    return [];
  }

  const actions: RecoveryAction[] = [];
  const downgradeUrgency = !input.staffOnFloor;

  const pushEscalation = (
    urgency: "normal" | "urgent",
    reason: string
  ): void => {
    actions.push({
      kind: "staff_escalation",
      urgency: downgradeUrgency && urgency === "urgent" ? "normal" : urgency,
      reason,
    });
  };

  if (sentiment < -0.5) {
    pushEscalation("normal", "negative_sentiment");
    actions.push({
      kind: "empathy_reply",
      message: EMPATHY_NEGATIVE[locale],
    });
    return actions;
  }

  if (level === "mild") {
    if (waiting) {
      actions.push({
        kind: "empathy_reply",
        message: EMPATHY_WAITING[locale],
      });
    } else if (!hasOrders) {
      actions.push({
        kind: "empathy_reply",
        message: EMPATHY_NO_ORDERS[locale],
      });
    }
    return actions;
  }

  if (level === "high") {
    if (waiting) {
      pushEscalation("urgent", "frustrated_waiting");
      actions.push({
        kind: "empathy_reply",
        message: EMPATHY_WAITING[locale],
      });
    } else {
      actions.push({ kind: "tone_adjustment", style: "concise_only" });
    }
    return actions;
  }

  return actions;
}
