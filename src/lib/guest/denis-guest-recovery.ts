import {
  handoffNarrationMessage,
  paymentMethodQuickReplyLabels,
} from "@/lib/denis/runtime/act/handoff-narration";
import type { OrderFact } from "@/lib/denis/loop/types";
import { tForAiGuestLanguage } from "@/lib/ai/guest-language";
import type { TranslationKey } from "@/lib/i18n/translations";
import type { SceneSituation, SceneSituationOrder } from "@/lib/scene/types";

export type GuestRecoveryIntent =
  | "payment"
  | "status"
  | "waiter"
  | "order"
  | "general";

export type GuestRecoveryTier = 0 | 1 | 2;

export type GuestRecoveryAction = {
  openPaymentSheet?: boolean;
  tryWaiterCall?: boolean;
};

export type GuestRecoveryResult = {
  message: string;
  tier: GuestRecoveryTier;
  quickReplies?: string[];
  action?: GuestRecoveryAction;
  /** Answered from dock/scene without calling chat API. */
  answeredLocally?: boolean;
};

export class GuestRecoveryError extends Error {
  readonly recovery: GuestRecoveryResult;

  constructor(recovery: GuestRecoveryResult) {
    super(recovery.message);
    this.name = "GuestRecoveryError";
    this.recovery = recovery;
  }
}

const PAYMENT_PATTERN =
  /\b(platim|platiti|platimo|zaplat|račun|racun|rechnung|bill|pay|bezahlen|checkout|mogu\s+li\s+da\s+platim)\b/i;
const STATUS_PATTERN =
  /\b(kad\s+sti[žz]e|kada\s+sti[žz]e|gde\s+je|gdje\s+je|status|ready|fertig|spremn|koliko\s+čeka|order\s+status|moj\s+burger|moje\s+pivo)\b/i;
const WAITER_PATTERN =
  /\b(konobar[a-zšđčćž]*|kellner|waiter|garson|pozov[a-zšđčćž]*|ne\s+mogu\s+da\s+pozov)\b/i;
const ORDER_PATTERN =
  /\b(naru[čc]|poru[čc]|dodaj|ho[ćc]u|želim|zelim|pivo|burger|meni|menu)\b/i;

const WAITER_CONFIRM_PATTERN =
  /^(da,?\s*)?(pozovi|pozovite)\s+konobara/i;

const OPEN_ORDER_STATUSES = new Set([
  "pending",
  "pending_approval",
  "confirmed",
  "accepted",
  "preparing",
  "ready",
]);

export function classifyGuestRecoveryIntent(message: string): GuestRecoveryIntent {
  const text = message.trim();
  if (!text) return "general";
  if (PAYMENT_PATTERN.test(text)) return "payment";
  if (STATUS_PATTERN.test(text)) return "status";
  if (WAITER_PATTERN.test(text)) return "waiter";
  if (ORDER_PATTERN.test(text)) return "order";
  return "general";
}

export function isWaiterConfirmMessage(message: string): boolean {
  const text = message.trim().toLowerCase();
  if (WAITER_CONFIRM_PATTERN.test(text)) return true;
  if (/^(da|yes|ja),?\s*(pozovi|pozovite|rufen|call)/.test(text)) return true;
  return false;
}

export function sceneSituationToOrderFacts(
  orders: SceneSituationOrder[]
): OrderFact[] {
  return orders.map((order) => ({
    id: order.orderId,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    estimatedPrepMinutes: order.prepMinutes,
    createdAt: new Date().toISOString(),
    items: order.itemsLabel
      .split(/[,·•]/)
      .map((name) => name.trim())
      .filter(Boolean)
      .map((productName) => ({ productName, quantity: 1 })),
  }));
}

function openSituationOrders(
  situation: SceneSituation | null | undefined
): SceneSituationOrder[] {
  if (!situation?.orders.length) return [];
  return situation.orders.filter((order) =>
    OPEN_ORDER_STATUSES.has(order.status)
  );
}

function hasPayableContext(input: {
  situation?: SceneSituation | null;
  cartItemCount: number;
}): boolean {
  if (input.cartItemCount > 0) return true;
  const open = openSituationOrders(input.situation);
  return open.some((order) => order.paymentStatus !== "paid");
}

function waiterConfirmQuickReply(language: string): string {
  const lang = language.toLowerCase().slice(0, 2);
  if (lang === "de") return "Ja, Kellner rufen";
  if (lang === "en") return "Yes, call waiter";
  return "Da, pozovi konobara";
}

function statusFollowUpChips(
  language: string,
  situation: SceneSituation | null | undefined
): string[] | undefined {
  if (!situation) return undefined;
  const lang = language.toLowerCase().slice(0, 2);
  if (situation.hasActiveKitchen) {
    if (lang === "de") return ["Noch etwas", "Bezahlen"];
    if (lang === "en") return ["Add more", "Pay"];
    return ["Još nešto", "Platiti"];
  }
  if (situation.hasReadyOrder) {
    if (lang === "de") return ["Danke"];
    if (lang === "en") return ["Thanks"];
    return ["Hvala"];
  }
  return undefined;
}

function recoveryKey(
  intent: GuestRecoveryIntent,
  tier: GuestRecoveryTier
): TranslationKey {
  if (tier === 2) return "ai.recovery.escalateWaiter";
  if (tier === 1) return "ai.recovery.connection";
  switch (intent) {
    case "payment":
      return "ai.recovery.retryPayment";
    case "status":
      return "ai.recovery.retryStatus";
    case "waiter":
      return "ai.recovery.retryWaiter";
    case "order":
      return "ai.recovery.retryOrder";
    default:
      return "ai.recovery.retryGeneral";
  }
}

function knownStatusMessage(
  situation: SceneSituation | null | undefined,
  language: string
): string | null {
  const open = openSituationOrders(situation);
  if (!open.length) return null;
  return openOrderStatusGuestMessage(
    sceneSituationToOrderFacts(open),
    language
  );
}

function contextualTier0Message(input: {
  intent: GuestRecoveryIntent;
  language: string;
  situation?: SceneSituation | null;
  cartItemCount: number;
}): Pick<GuestRecoveryResult, "message" | "quickReplies"> {
  if (input.intent === "status") {
    const status = knownStatusMessage(input.situation, input.language);
    if (status) {
      return {
        message: status,
        quickReplies: statusFollowUpChips(input.language, input.situation),
      };
    }
    return {
      message: tForAiGuestLanguage("ai.recovery.noOpenOrders", input.language),
      quickReplies: undefined,
    };
  }

  if (input.intent === "payment") {
    if (!hasPayableContext(input)) {
      return {
        message: handoffNarrationMessage("nothing_to_pay", input.language),
      };
    }
    return {
      message: handoffNarrationMessage("ask_payment_method", input.language),
      quickReplies: paymentMethodQuickReplyLabels(input.language),
    };
  }

  if (input.intent === "waiter") {
    return {
      message: tForAiGuestLanguage("ai.recovery.retryWaiter", input.language),
      quickReplies: [waiterConfirmQuickReply(input.language)],
    };
  }

  return {
    message: tForAiGuestLanguage(
      recoveryKey(input.intent, 0),
      input.language
    ),
  };
}

/** Smart recovery — uses scene context when API fails. */
export function resolveGuestRecoveryResponse(input: {
  guestMessage: string;
  failureCount: number;
  language: string;
  situation?: SceneSituation | null;
  cartItemCount?: number;
}): GuestRecoveryResult {
  const intent = classifyGuestRecoveryIntent(input.guestMessage);
  const tier: GuestRecoveryTier =
    input.failureCount >= 3 ? 2 : input.failureCount >= 2 ? 1 : 0;
  const cartItemCount = input.cartItemCount ?? 0;

  if (tier === 0) {
    const contextual = contextualTier0Message({
      intent,
      language: input.language,
      situation: input.situation,
      cartItemCount,
    });
    return { tier, ...contextual };
  }

  const knownStatus = knownStatusMessage(input.situation, input.language);
  const escalation = tForAiGuestLanguage(
    recoveryKey(intent, tier),
    input.language
  );

  let message = escalation;
  if (knownStatus && (intent === "status" || intent === "payment")) {
    message = `${knownStatus}\n\n${escalation}`;
  }

  const quickReplies =
    tier === 1 && intent === "payment" && hasPayableContext({ ...input, cartItemCount })
      ? paymentMethodQuickReplyLabels(input.language)
      : tier === 1 && intent === "waiter"
        ? [waiterConfirmQuickReply(input.language)]
        : undefined;

  return {
    tier,
    message,
    quickReplies,
    action: tier === 2 ? { tryWaiterCall: true } : undefined,
  };
}

/** @deprecated Use resolveGuestRecoveryResponse */
export function resolveGuestRecoveryMessage(input: {
  guestMessage: string;
  failureCount: number;
  language: string;
}): { message: string; tier: GuestRecoveryTier } {
  const result = resolveGuestRecoveryResponse(input);
  return { message: result.message, tier: result.tier };
}

/**
 * Instant answer from dock/scene — no API, no credits.
 * Denis "knows" the table from the situation projection.
 */
export function tryLocalGuestAnswer(input: {
  guestMessage: string;
  language: string;
  situation?: SceneSituation | null;
  cartItemCount: number;
}): GuestRecoveryResult | null {
  const intent = classifyGuestRecoveryIntent(input.guestMessage);
  if (intent === "general" || intent === "order") return null;

  if (intent === "status") {
    const open = openSituationOrders(input.situation);
    if (!input.situation) return null;
    if (!open.length) {
      return {
        tier: 0,
        answeredLocally: true,
        message: tForAiGuestLanguage("ai.recovery.noOpenOrders", input.language),
      };
    }
    const message = knownStatusMessage(input.situation, input.language);
    if (!message) return null;
    return {
      tier: 0,
      answeredLocally: true,
      message,
      quickReplies: statusFollowUpChips(input.language, input.situation),
    };
  }

  if (intent === "payment") {
    if (!hasPayableContext(input)) {
      return {
        tier: 0,
        answeredLocally: true,
        message: handoffNarrationMessage("nothing_to_pay", input.language),
      };
    }
    return {
      tier: 0,
      answeredLocally: true,
      message: handoffNarrationMessage("ask_payment_method", input.language),
      quickReplies: paymentMethodQuickReplyLabels(input.language),
    };
  }

  if (intent === "waiter") {
    const autoCall =
      isWaiterConfirmMessage(input.guestMessage) ||
      /ne\s+mogu\s+da\s+pozov/i.test(input.guestMessage);
    if (autoCall) {
      return {
        tier: 0,
        answeredLocally: true,
        message: handoffNarrationMessage("waiter_on_way", input.language),
        action: { tryWaiterCall: true },
      };
    }
    return {
      tier: 0,
      answeredLocally: true,
      message: tForAiGuestLanguage("ai.recovery.retryWaiter", input.language),
      quickReplies: [waiterConfirmQuickReply(input.language)],
    };
  }

  return null;
}

export function isInfrastructureChatError(
  error: string | undefined,
  status: number
): boolean {
  if (status === 504 || status === 502 || status === 503) return true;
  if (
    error === "signal_timeout" ||
    error === "signal_processing_failed" ||
    error === "signal_failed"
  ) {
    return true;
  }
  return false;
}

const RECOVERY_COUNT_KEY = "denis:recovery-failures";

export function readGuestRecoveryFailureCount(scopeKey: string): number {
  if (typeof sessionStorage === "undefined") return 0;
  try {
    const raw = sessionStorage.getItem(`${RECOVERY_COUNT_KEY}:${scopeKey}`);
    const parsed = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

export function bumpGuestRecoveryFailureCount(scopeKey: string): number {
  const next = readGuestRecoveryFailureCount(scopeKey) + 1;
  if (typeof sessionStorage !== "undefined") {
    try {
      sessionStorage.setItem(`${RECOVERY_COUNT_KEY}:${scopeKey}`, String(next));
    } catch {
      /* ignore quota */
    }
  }
  return next;
}

export function clearGuestRecoveryFailureCount(scopeKey: string): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(`${RECOVERY_COUNT_KEY}:${scopeKey}`);
  } catch {
    /* ignore */
  }
}

const ORDER_STATUS_MESSAGE_KEYS = {
  pending: "ai.order.status.pending",
  pending_approval: "ai.order.status.pendingApproval",
  confirmed: "ai.order.status.accepted",
  accepted: "ai.order.status.accepted",
  preparing: "ai.order.status.preparing",
  ready: "ai.order.status.ready",
} as const satisfies Record<string, TranslationKey>;

/** Guest-facing kitchen status — 0 credits, from FOLD orders. */
export function openOrderStatusGuestMessage(
  orders: OrderFact[],
  language: string
): string | null {
  const open = orders.filter(
    (order) => order.status !== "delivered" && order.status !== "cancelled"
  );
  if (!open.length) return null;

  const primary = open[0]!;
  const number = primary.orderNumber != null ? String(primary.orderNumber) : "?";
  const statusKey =
    ORDER_STATUS_MESSAGE_KEYS[
      primary.status as keyof typeof ORDER_STATUS_MESSAGE_KEYS
    ];

  const statusLine = statusKey
    ? tForAiGuestLanguage(statusKey, language, { number })
    : tForAiGuestLanguage("ai.recovery.statusLive", language, {
        number,
        items: primary.status,
      });

  const items = primary.items
    .map((item) => item.productName)
    .filter(Boolean)
    .join(", ");

  if (!items) return statusLine;
  return `${statusLine} (${items})`;
}
