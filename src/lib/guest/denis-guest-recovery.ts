import type { ParsedApiError } from "@/lib/api-error-client";
import { ERROR_CODES } from "@/lib/api-error-client";
import { parseHandoffPaymentMethod } from "@/lib/denis/commands/perceive-table-guest-command";
import { templateUtteranceForKey } from "@/lib/denis/cognition/tde/template-utterance";
import {
  handoffNarrationMessage,
  paymentMethodNarrationKey,
} from "@/lib/denis/runtime/act/handoff-narration";
import type { OrderFact } from "@/lib/denis/loop/types";
import type { FreshStationAnswer } from "@/lib/denis/stations/station-question-messages";
import { buildStationAwareOrderStatusMessage } from "@/lib/guest/station-guest-message";
import { tForAiGuestLanguage } from "@/lib/ai/guest-language";
import type { TranslationKey } from "@/lib/i18n/translations";
import { formatPrice } from "@/lib/format";
import type { SelectablePaymentMethod } from "@/lib/payment-methods";
import type { SceneSituation, SceneSituationOrder } from "@/lib/scene/types";

export type GuestRecoveryIntent =
  | "payment"
  | "bill_amount"
  | "status"
  | "waiter"
  | "order"
  | "general";

export type GuestRecoveryTier = 0 | 1 | 2;

export type GuestRecoveryAction = {
  openPaymentSheet?: boolean;
  tryWaiterCall?: boolean;
  tryPaymentHandoff?: SelectablePaymentMethod;
  /** Navigate guest to manual cart — LLM degraded for ordering intent. */
  suggestManualCart?: boolean;
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

/** Retryable API failure — guest can tap "Try again" to resend the same message. */
export class GuestRetryableChatError extends Error {
  readonly displayMessage: string;
  readonly retryUserMessage: string;
  readonly tryAgainLabel: string;

  constructor(input: {
    displayMessage: string;
    retryUserMessage: string;
    tryAgainLabel: string;
  }) {
    super(input.displayMessage);
    this.name = "GuestRetryableChatError";
    this.displayMessage = input.displayMessage;
    this.retryUserMessage = input.retryUserMessage;
    this.tryAgainLabel = input.tryAgainLabel;
  }
}

/** Menu browse / recommendation — guest thinking + recovery heuristics. */
export const MENU_BROWSE_PATTERN =
  /(šta\s+imate|sta\s+imate|šta\s+imam|sta\s+imam|was\s+habt|what\s+do\s+you\s+have|preporuk|empfehl|recommend|suggest|pivo|pizza|jelo|piće|pice|drink|dessert|desert|vegan|vegetar|gluten|allerg)/i;

/** Guest asked Denis to wait — pause thinking context. */
export const GUEST_PAUSE_PATTERN =
  /\b(nisam\s+j[oš]s?|ne\s+j[oš]s?|jo[sš]\s+gledamo|not\s+yet|noch\s+nicht|dođi|dodji|vrati\s+se|come\s+back|za\s+\d+\s*minut|\d+\s*minut\s+ponovo|za\s+koj[ií]\s+minut)\b/i;

export function isGuestPauseMessage(message: string): boolean {
  return GUEST_PAUSE_PATTERN.test(message.trim());
}

export function isMenuBrowseMessage(message: string): boolean {
  return MENU_BROWSE_PATTERN.test(message.trim());
}

const PAYMENT_PATTERN =
  /\b(platim|platiti|platimo|zaplat|ho[ćc]u\s+da\s+platim|mogu\s+li\s+da\s+platim|rechnung\s+bitte|pay\s+now|bezahlen|checkout)\b/i;

const BILL_AMOUNT_PATTERN =
  /\b(kolik\w*\s+.*?(račun|racun|ukupno|sve\s+skupa)|iznos(\s+računa)?|ukupno\s+je|how\s+much|what('s| is)\s+(the\s+)?(bill|total)|wie\s+(viel|hoch).*rechnung)\b/i;

const ADD_MORE_CHIP_PATTERN =
  /^(jo[sš]\s+nešto|jos\s+nesto|noch\s+etwas|add\s+more|something\s+else)$/i;
const STATUS_PATTERN =
  /\b(kad\s+sti[žz]e|kada\s+sti[žz]e|gde\s+je|gdje\s+je|status|ready|fertig|spremn|koliko\s+čeka|order\s+status|moj\s+burger|moje\s+pivo)\b/i;
const WAITER_PATTERN =
  /\b(konobar[a-zšđčćž]*|kellner|waiter|garson|pozov[a-zšđčćž]*|ne\s+mogu\s+da\s+pozov)\b/i;
const ORDER_PATTERN =
  /\b(naru[čc]|poru[čc]|dodaj|ho[ćc]u|želim|zelim|pivo|burger|meni|menu)\b/i;

const WAITER_CONFIRM_PATTERN =
  /^(da,?\s*)?(pozovi|pozovite)\s+konobara/i;

const PAY_CARD_CHIP_PATTERN =
  /^(plati\s+karticom|pay\s+by\s+card|mit\s+karte\s+zahlen)$/i;
const SPLIT_BILL_CHIP_PATTERN =
  /^(podeli\s+(račun|racun)|split(\s+the)?\s+bill|rechnung\s+teilen)$/i;
const CALL_WAITER_CHIP_PATTERN =
  /^(pozovi\s+konobara|call\s+(the\s+)?waiter|kellner\s+rufen)$/i;
const STATUS_DETAIL_CHIP_PATTERN =
  /^(detaljnije|more\s+details|mehr\s+details)$/i;

const SETTLING_PATTERN =
  /\b(to je sve|to je to|samo to|that's all|that's it|fertig|das war'?s|done ordering)\b/i;

const ALREADY_ORDERED_PATTERN =
  /\b(poručio|porucio|naručio|narucio|poslao|poslata|već\s+naruč|vec\s+naruc|already ordered|bereits bestellt)\b/i;

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
  if (BILL_AMOUNT_PATTERN.test(text)) return "bill_amount";
  if (PAYMENT_PATTERN.test(text)) return "payment";
  if (STATUS_PATTERN.test(text)) return "status";
  if (WAITER_PATTERN.test(text)) return "waiter";
  if (ORDER_PATTERN.test(text)) return "order";
  return "general";
}

/** Route intent to recovery tier — 0 local, 1 contextual, 2 LLM. */
export function resolveIntentRecoveryTier(
  intent: GuestRecoveryIntent
): GuestRecoveryTier {
  switch (intent) {
    case "payment":
    case "status":
      return 0;
    case "bill_amount":
    case "waiter":
      return 1;
    default:
      return 2;
  }
}

export function paymentRecoveryQuickReplies(language: string): string[] {
  const lang = language.toLowerCase().slice(0, 2);
  if (lang === "de") return ["Mit Karte zahlen", "Rechnung teilen", "Kellner rufen"];
  if (lang === "en") return ["Pay by card", "Split bill", "Call waiter"];
  return ["Plati karticom", "Podeli račun", "Pozovi konobara"];
}

export function statusRecoveryQuickReplies(language: string): string[] {
  const lang = language.toLowerCase().slice(0, 2);
  if (lang === "de") return ["Mehr Details", "Kellner rufen"];
  if (lang === "en") return ["More details", "Call waiter"];
  return ["Detaljnije", "Pozovi konobara"];
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

function addMoreReplyMessage(language: string): string {
  const lang = language.toLowerCase().slice(0, 2);
  if (lang === "de") return "Alles klar — was darf ich noch bringen?";
  if (lang === "en") return "Sure — what else would you like to add?";
  return "U redu — šta još želite da dodam?";
}

function billAmountReply(input: {
  language: string;
  situation?: SceneSituation | null;
  cartTotal: number;
  currency: string;
}): Pick<GuestRecoveryResult, "message" | "quickReplies" | "action"> {
  const lang = input.language.toLowerCase().slice(0, 2);
  if (input.cartTotal > 0) {
    const total = formatPrice(input.cartTotal, input.currency);
    const message =
      lang === "de"
        ? `Aktuell in der Bestellung: ${total}.`
        : lang === "en"
          ? `Your cart total is ${total}.`
          : `Trenutno u korpi: ${total}.`;
    return {
      message,
      quickReplies: paymentRecoveryQuickReplies(input.language),
    };
  }

  const open = openSituationOrders(input.situation);
  const unpaid = open.filter((order) => order.paymentStatus !== "paid");
  if (unpaid.length) {
    const summary = unpaid
      .map((order) =>
        order.orderNumber > 0
          ? `#${order.orderNumber} ${order.itemsLabel}`
          : order.itemsLabel
      )
      .join(", ");
    const message =
      lang === "de"
        ? `Ihre Bestellung: ${summary}. Ich öffne die Rechnung mit dem genauen Betrag.`
        : lang === "en"
          ? `Your order: ${summary}. I'll open the bill with the exact total.`
          : `Vaša porudžbina: ${summary}. Otvaram račun sa tačnim iznosom.`;
    return {
      message,
      action: { openPaymentSheet: true },
      quickReplies: paymentRecoveryQuickReplies(input.language),
    };
  }

  return {
    message: handoffNarrationMessage("nothing_to_pay", input.language),
  };
}

function statusFollowUpChips(
  language: string,
  situation: SceneSituation | null | undefined
): string[] | undefined {
  if (!situation) return undefined;
  return statusRecoveryQuickReplies(language);
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
    case "bill_amount":
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

function resolvePaymentMethodAnswer(
  guestMessage: string,
  language: string
): Pick<GuestRecoveryResult, "message" | "action"> | null {
  const method = parseHandoffPaymentMethod(guestMessage);
  if (!method) return null;

  return {
    message: handoffNarrationMessage(paymentMethodNarrationKey(method), language),
    action: {
      tryPaymentHandoff: method,
      openPaymentSheet: method === "online",
    },
  };
}

function detailedStatusMessage(
  situation: SceneSituation | null | undefined,
  language: string
): string | null {
  const open = openSituationOrders(situation);
  if (!open.length) return null;

  const lang = language.toLowerCase().slice(0, 2);
  const lines = open.map((order) => {
    const number = order.orderNumber > 0 ? `#${order.orderNumber}` : "";
    const prep =
      order.prepMinutes != null && order.prepMinutes > 0
        ? lang === "de"
          ? ` · ~${order.prepMinutes} Min`
          : lang === "en"
            ? ` · ~${order.prepMinutes} min`
            : ` · ~${order.prepMinutes} min`
        : "";
    return `${number} ${order.itemsLabel} (${order.status})${prep}`.trim();
  });

  const header =
    lang === "de"
      ? "Ihre Bestellungen:"
      : lang === "en"
        ? "Your orders:"
        : "Vaše porudžbine:";
  return `${header}\n${lines.join("\n")}`;
}

/** Parse recovery quick-reply chip taps — tier 0, no API. */
function parseRecoveryChipReply(input: {
  guestMessage: string;
  language: string;
  situation?: SceneSituation | null;
}): GuestRecoveryResult | null {
  const text = input.guestMessage.trim();
  if (!text) return null;

  if (PAY_CARD_CHIP_PATTERN.test(text)) {
    return {
      tier: 0,
      answeredLocally: true,
      message: handoffNarrationMessage("payment_online", input.language),
      action: {
        tryPaymentHandoff: "online",
        openPaymentSheet: true,
      },
    };
  }

  if (SPLIT_BILL_CHIP_PATTERN.test(text)) {
    return {
      tier: 0,
      answeredLocally: true,
      message: handoffNarrationMessage("split_bill_active", input.language),
      action: { openPaymentSheet: true },
    };
  }

  if (CALL_WAITER_CHIP_PATTERN.test(text)) {
    return {
      tier: 0,
      answeredLocally: true,
      message: handoffNarrationMessage("waiter_on_way", input.language),
      action: { tryWaiterCall: true },
    };
  }

  if (STATUS_DETAIL_CHIP_PATTERN.test(text)) {
    const detail = detailedStatusMessage(input.situation, input.language);
    if (!detail) {
      return {
        tier: 0,
        answeredLocally: true,
        message: tForAiGuestLanguage(
          "ai.recovery.noOpenOrders",
          input.language
        ),
      };
    }
    return {
      tier: 0,
      answeredLocally: true,
      message: detail,
      quickReplies: statusRecoveryQuickReplies(input.language),
    };
  }

  return null;
}

function postOrderSettleMessage(
  situation: SceneSituation | null | undefined,
  language: string
): string {
  const thanks =
    templateUtteranceForKey("settle.thanks", language) ??
    handoffNarrationMessage("waiter_on_way", language);
  const status = knownStatusMessage(situation, language);
  if (!status) return thanks;
  return `${status}\n\n${thanks}`;
}

function contextualTier0Message(input: {
  intent: GuestRecoveryIntent;
  language: string;
  situation?: SceneSituation | null;
  cartItemCount: number;
}): Pick<GuestRecoveryResult, "message" | "quickReplies" | "action"> {
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
      message: handoffNarrationMessage("payment_online", input.language),
      quickReplies: paymentRecoveryQuickReplies(input.language),
      action: { openPaymentSheet: true },
    };
  }

  if (input.intent === "bill_amount") {
    return billAmountReply({
      language: input.language,
      situation: input.situation,
      cartTotal: 0,
      currency: "EUR",
    });
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
  cartTotal?: number;
  currency?: string;
}): GuestRecoveryResult {
  const intent = classifyGuestRecoveryIntent(input.guestMessage);
  const tier: GuestRecoveryTier =
    input.failureCount >= 3 ? 2 : input.failureCount >= 2 ? 1 : 0;
  const cartItemCount = input.cartItemCount ?? 0;

  if (tier === 0) {
    const paymentMethod = resolvePaymentMethodAnswer(
      input.guestMessage,
      input.language
    );
    if (paymentMethod) {
      return { tier, ...paymentMethod };
    }

    if (intent === "bill_amount") {
      return {
        tier,
        ...billAmountReply({
          language: input.language,
          situation: input.situation,
          cartTotal: input.cartTotal ?? 0,
          currency: input.currency ?? "EUR",
        }),
      };
    }

    const contextual = contextualTier0Message({
      intent,
      language: input.language,
      situation: input.situation,
      cartItemCount,
    });
    return { tier, ...contextual };
  }

  const paymentMethod = resolvePaymentMethodAnswer(
    input.guestMessage,
    input.language
  );
  if (paymentMethod) {
    return { tier, ...paymentMethod };
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

  let quickReplies: string[] | undefined;
  if (tier === 1 && intent === "payment" && hasPayableContext({ ...input, cartItemCount })) {
    quickReplies = paymentRecoveryQuickReplies(input.language);
  } else if (tier === 1 && intent === "waiter") {
    quickReplies = [waiterConfirmQuickReply(input.language)];
  }

  const action =
    tier === 2
      ? { tryWaiterCall: true as const }
      : tier === 1 && intent === "order"
        ? { suggestManualCart: true as const }
        : undefined;

  return {
    tier,
    message,
    quickReplies,
    action,
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
 * Instant answer from dock/scene — disabled; all guest replies go through Denis LLM.
 */
export function tryLocalGuestAnswer(_input: {
  guestMessage: string;
  language: string;
  situation?: SceneSituation | null;
  cartItemCount: number;
  cartTotal?: number;
  currency?: string;
}): GuestRecoveryResult | null {
  return null;
}

export function isInfrastructureChatError(
  error: string | ParsedApiError | null | undefined,
  status: number
): boolean {
  if (status === 504 || status === 502 || status === 503) return true;

  const code =
    error && typeof error === "object" ? error.code : undefined;
  const message =
    error && typeof error === "object"
      ? error.message
      : typeof error === "string"
        ? error
        : undefined;

  if (
    code === ERROR_CODES.CIRCUIT_OPEN ||
    code === ERROR_CODES.INTERNAL
  ) {
    return true;
  }

  if (
    message === "signal_timeout" ||
    message === "signal_processing_failed" ||
    message === "signal_failed"
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
  language: string,
  options?: { freshEta?: FreshStationAnswer | null }
): string | null {
  const open = orders.filter(
    (order) => order.status !== "delivered" && order.status !== "cancelled"
  );
  if (!open.length) return null;

  const primary = open[0]!;
  const stationMessage = buildStationAwareOrderStatusMessage({
    order: primary,
    language,
    freshEta: options?.freshEta,
  });

  const number = primary.orderNumber != null ? String(primary.orderNumber) : "?";
  const statusKey =
    ORDER_STATUS_MESSAGE_KEYS[
      primary.status as keyof typeof ORDER_STATUS_MESSAGE_KEYS
    ];

  const statusLine = stationMessage
    ? stationMessage
    : statusKey
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
