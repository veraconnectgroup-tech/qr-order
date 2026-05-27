"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Send, Sparkles, X, Check, Plus } from "lucide-react";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import type { ProductRecommendation } from "@/components/guest/product-recommendation-card";
import type { MenuCategory } from "@/components/guest/menu-grid";
import { getDemoAiChatResponse } from "@/lib/demo-ai";
import {
  AI_SHEET_ALLERGY_OPTIONS,
  AI_SHEET_MOOD_OPTIONS,
  allergenIdsFromSheetSelections,
  apiPreferencesFromSheet,
  type AiSheetAllergyId,
  type AiSheetMoodId,
  type AiSheetSelections,
} from "@/lib/ai/guest-sheet-preferences";
import {
  clearAiSessionIdForGuest,
  readAiSessionIdForGuest,
  resolveGuestAiContextToken,
  writeAiSessionIdForGuest,
} from "@/lib/ai/guest-ai-token";
import {
  trackAiConversion,
} from "@/lib/ai/guest-session-storage";
import {
  getOrCreateDeviceFingerprint,
  getStoredDeviceToken,
} from "@/lib/guest/device-storage";
import { recordGuestOrderPlaced } from "@/lib/pwa/install-timing";
import { useAiOrderStatus } from "@/hooks/use-ai-order-status";
import { toastAddedToCart } from "@/lib/cart-toast";
import { formatPrice } from "@/lib/format";
import { hapticClick, hapticSuccess } from "@/lib/haptics";
import type { MenuSection } from "@/lib/menu-section";
import type { AllergenId } from "@/lib/allergens";
import type { GuestMemoryProfile } from "@/lib/guest/guest-memory-storage";
import { useCart } from "@/hooks/use-cart";
import { cn } from "@/lib/utils";

type QuickPickOption = { id: string; label: string };

type ChatQuickPicksConfig = {
  options: QuickPickOption[];
  mode: "multi" | "single";
  confirmed: boolean;
};

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  quickPicks?: ChatQuickPicksConfig;
  quickReplies?: string[];
  quickRepliesUsed?: boolean;
  recommendations?: ProductRecommendation[];
};

type ValidatedCartAction = {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  notes: string;
  serveSize: string | null;
  menuSection: MenuSection;
  productTaxRate: number | null;
  modifiers: Array<{
    modifierId: string;
    modifierName: string;
    price: number;
  }>;
  lineTotal: number;
};

type ChatPhase = "allergies" | "mood" | "chat";

function mapAiChatError(
  error: string | undefined,
  status: number,
  details: { code?: string } | undefined,
  tUI: (key: string) => string
): string {
  if (details?.code === "not_configured" || error?.includes("not configured")) {
    return tUI("ai.overlay.unavailable");
  }
  if (error === "insufficient_credits") {
    return tUI("ai.overlay.noCredits");
  }
  if (error?.includes("not enabled")) {
    return tUI("ai.overlay.unavailable");
  }
  if (status === 401 || error?.includes("Session expired")) {
    return tUI("ai.overlay.sessionExpired");
  }
  if (status === 403 && error?.includes("Session does not match")) {
    return tUI("ai.overlay.sessionExpired");
  }
  if (status === 429) {
    return tUI("ai.overlay.rateLimited");
  }
  if (status === 502 || status === 503) {
    return tUI("ai.overlay.unavailable");
  }
  return error ?? tUI("ai.overlay.error");
}

function nextId() {
  return crypto.randomUUID();
}

function ChatTypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-3 py-2">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-2 animate-bounce rounded-full bg-zinc-500"
          style={{ animationDelay: `${i * 120}ms`, animationDuration: "0.9s" }}
        />
      ))}
    </div>
  );
}

function ChatQuickPicks({
  options,
  mode,
  confirmed,
  onConfirm,
  continueLabel,
}: {
  options: QuickPickOption[];
  mode: "multi" | "single";
  confirmed: boolean;
  onConfirm: (ids: string[]) => void;
  continueLabel: string;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(id: string) {
    if (confirmed) return;
    if (mode === "single") {
      setSelected((prev) => (prev.includes(id) ? [] : [id]));
      return;
    }
    if (id === "keine") {
      setSelected(["keine"]);
      return;
    }
    setSelected((prev) => {
      const withoutKeine = prev.filter((item) => item !== "keine");
      if (withoutKeine.includes(id)) {
        return withoutKeine.filter((item) => item !== id);
      }
      return [...withoutKeine, id];
    });
  }

  const canContinue = mode === "multi" || selected.length === 1;

  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isSelected = selected.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              disabled={confirmed}
              onClick={() => toggle(option.id)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-medium transition",
                confirmed
                  ? isSelected
                    ? "border-orange-500/40 bg-orange-500/10 text-orange-300/80"
                    : "border-zinc-800 bg-zinc-900/50 text-zinc-600"
                  : isSelected
                    ? "border-orange-500 bg-orange-500/20 text-orange-200"
                    : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-600"
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {!confirmed && (
        <button
          type="button"
          disabled={!canContinue}
          onClick={() =>
            onConfirm(
              selected.length > 0
                ? selected
                : mode === "multi"
                  ? ["keine"]
                  : selected
            )
          }
          className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {continueLabel}
        </button>
      )}
    </div>
  );
}

function ChatQuickReplies({
  options,
  used,
  onSelect,
}: {
  options: string[];
  used: boolean;
  onSelect: (label: string) => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          disabled={used}
          onClick={() => onSelect(option)}
          className={cn(
            "rounded-full border px-3 py-1.5 text-sm font-medium transition",
            used
              ? "border-zinc-800 bg-zinc-900/50 text-zinc-600"
              : "border-orange-500/40 bg-orange-500/10 text-orange-200 hover:border-orange-500 hover:bg-orange-500/20"
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function ChatMenuPickList({
  recommendations,
  currency,
  orderingDisabled,
  addedIds,
  onAdd,
}: {
  recommendations: ProductRecommendation[];
  currency: string;
  orderingDisabled: boolean;
  addedIds: Set<string>;
  onAdd: (rec: ProductRecommendation) => void;
}) {
  if (!recommendations.length) return null;

  return (
    <div className="mt-3 space-y-2">
      {recommendations.map((rec) => {
        const added = addedIds.has(rec.productId);
        return (
          <div
            key={rec.productId}
            className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/90 p-2"
          >
            <div className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-zinc-800">
              {rec.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={rec.imageUrl}
                  alt={rec.name}
                  className="size-full object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900">
                  <Sparkles className="size-4 text-zinc-600" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-zinc-100">
                {rec.name}
              </p>
              <p className="text-xs font-bold text-orange-500">
                {formatPrice(rec.price, currency)}
              </p>
            </div>
            <button
              type="button"
              disabled={orderingDisabled || added}
              onClick={() => onAdd(rec)}
              aria-label={rec.name}
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-full transition active:scale-95",
                added
                  ? "bg-zinc-800 text-zinc-400"
                  : "bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50"
              )}
            >
              {added ? <Check className="size-4" /> : <Plus className="size-4" />}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function ChatBubble({
  message,
  currency,
  orderingDisabled,
  addedIds,
  onQuickPickConfirm,
  onQuickReply,
  onAddRecommendation,
  continueLabel,
}: {
  message: ChatMessage;
  currency: string;
  orderingDisabled: boolean;
  addedIds: Set<string>;
  onQuickPickConfirm?: (messageId: string, ids: string[]) => void;
  onQuickReply?: (messageId: string, label: string) => void;
  onAddRecommendation: (rec: ProductRecommendation) => void;
  continueLabel: string;
}) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn("flex gap-2", isUser ? "flex-row-reverse" : "flex-row")}
    >
      {!isUser && (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-orange-400">
          <Sparkles className="size-4" />
        </span>
      )}
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "bg-orange-500 text-white"
            : "bg-zinc-900 text-zinc-100"
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        {message.quickPicks && onQuickPickConfirm && (
          <ChatQuickPicks
            options={message.quickPicks.options}
            mode={message.quickPicks.mode}
            confirmed={message.quickPicks.confirmed}
            continueLabel={continueLabel}
            onConfirm={(ids) => onQuickPickConfirm(message.id, ids)}
          />
        )}
        {message.quickReplies?.length && onQuickReply && (
          <ChatQuickReplies
            options={message.quickReplies}
            used={message.quickRepliesUsed ?? false}
            onSelect={(label) => onQuickReply(message.id, label)}
          />
        )}
        {message.recommendations && (
          <ChatMenuPickList
            recommendations={message.recommendations}
            currency={currency}
            orderingDisabled={orderingDisabled}
            addedIds={addedIds}
            onAdd={onAddRecommendation}
          />
        )}
      </div>
    </div>
  );
}

export type AiConciergeChatProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  token: string;
  locationId: string;
  tableId: string;
  sessionToken: string | null;
  currency: string;
  orderingDisabled?: boolean;
  isDemo?: boolean;
  menuCategories?: MenuCategory[];
  menuSectionByProductId?: Map<string, MenuSection>;
  productTaxRateById?: Map<string, number | null>;
  onSetupComplete?: (payload: {
    recommendations: ProductRecommendation[];
    sessionId: string | null;
    preferences: { allergies: string[]; mood: string };
    allergenIds: AllergenId[];
  }) => void;
  /** @deprecated use scrollContext */
  getBrowsingContext?: () => string | null;
  scrollContext?: () => string | null;
  guestProfile?: GuestMemoryProfile;
  isReturning?: boolean;
  onAddToCart?: (rec: ProductRecommendation) => void;
  customizableProductIds?: Set<string>;
  onOpenProductDetail?: (productId: string) => void;
  /** Alias for onSetupComplete */
  onRecommendations?: AiConciergeChatProps["onSetupComplete"];
  welcomeBackMessage?: string | null;
  knownAllergySelection?: AiSheetAllergyId[];
  onSaveAllergies?: (
    allergies: string[],
    sheetIds: AiSheetAllergyId[]
  ) => void;
  /** Manual guest cart snapshot for Denis conflict detection (M11). */
  getManualCartSnapshot?: () =>
    | import("@/lib/guest/manual-cart-snapshot").GuestManualCartSnapshot
    | null
    | undefined;
};

export function AiConciergeChat({
  open,
  onOpenChange,
  token,
  locationId,
  tableId,
  sessionToken,
  currency,
  orderingDisabled = false,
  isDemo = false,
  menuCategories = [],
  menuSectionByProductId,
  productTaxRateById,
  onSetupComplete,
  getBrowsingContext,
  scrollContext,
  guestProfile,
  isReturning = false,
  onAddToCart,
  customizableProductIds,
  onOpenProductDetail,
  onRecommendations,
  welcomeBackMessage,
  knownAllergySelection,
  onSaveAllergies,
  getManualCartSnapshot,
}: AiConciergeChatProps) {
  const { tUI, menuLocale, isEnglish } = useAppLocale();
  const resolveScrollContext = scrollContext ?? getBrowsingContext;
  const handleRecommendations = onRecommendations ?? onSetupComplete;
  const resolvedAllergySelection =
    guestProfile?.allergySheetIds?.length
      ? guestProfile.allergySheetIds
      : (knownAllergySelection ?? []);
  const resolvedWelcomeMessage = useMemo(() => {
    if (welcomeBackMessage) return welcomeBackMessage;
    if (!isReturning || !guestProfile?.lastVisitItems.length) return null;
    return tUI("ai.memory.welcomeBack", {
      items: guestProfile.lastVisitItems.slice(0, 4).join(", "),
    });
  }, [welcomeBackMessage, isReturning, guestProfile?.lastVisitItems, tUI]);
  const language = isEnglish ? "en" : menuLocale;
  const addItem = useCart((s) => s.addItem);
  const clearCart = useCart((s) => s.clearCart);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatInitKeyRef = useRef<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [phase, setPhase] = useState<ChatPhase>("allergies");
  const [isTyping, setIsTyping] = useState(false);
  const [input, setInput] = useState("");
  const [aiSessionId, setAiSessionId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(() => new Set());
  const preferencesRef = useRef<{ allergies: string[]; mood: string }>({
    allergies: [],
    mood: "",
  });
  const allergySelectionRef = useRef<AiSheetAllergyId[]>([]);

  const allergyOptions: QuickPickOption[] = useMemo(
    () =>
      AI_SHEET_ALLERGY_OPTIONS.map((o) => ({
        id: o.id,
        label: tUI(`ai.chat.allergy.${o.id}` as "ai.chat.allergy.keine"),
      })),
    [tUI]
  );

  const moodOptions: QuickPickOption[] = useMemo(
    () =>
      AI_SHEET_MOOD_OPTIONS.map((o) => ({
        id: o.id,
        label: tUI(`ai.chat.mood.${o.id}` as "ai.chat.mood.leicht"),
      })),
    [tUI]
  );

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    });
  }, []);

  useEffect(() => {
    if (!open) {
      chatInitKeyRef.current = null;
      return;
    }

    const initKey = `${locationId}:${sessionToken ?? token ?? ""}`;
    if (chatInitKeyRef.current === initKey) return;
    chatInitKeyRef.current = initKey;

    const hasKnownAllergies = resolvedAllergySelection.length > 0;

    if (hasKnownAllergies) {
      const sheetIds = resolvedAllergySelection;
      preferencesRef.current = apiPreferencesFromSheet({
        allergies: sheetIds,
        mood: null,
      });
      allergySelectionRef.current = sheetIds;
    } else {
      preferencesRef.current = { allergies: [], mood: "" };
      allergySelectionRef.current = [];
    }

    const initialMessages: ChatMessage[] = [];
    if (resolvedWelcomeMessage) {
      initialMessages.push({
        id: nextId(),
        role: "assistant",
        content: resolvedWelcomeMessage,
      });
    }
    initialMessages.push({
      id: nextId(),
      role: "assistant",
      content: tUI("ai.chat.greeting"),
    });
    setMessages(initialMessages);
    setPhase("chat");

    setIsTyping(false);
    setInput("");
    setAddedIds(new Set());
    setAiSessionId(
      token
        ? readAiSessionIdForGuest(locationId, token, [sessionToken])
        : null
    );
  }, [
    open,
    locationId,
    token,
    sessionToken,
    tUI,
    allergyOptions,
    moodOptions,
    resolvedWelcomeMessage,
    resolvedAllergySelection,
  ]);

  const CHAT_FETCH_TIMEOUT_MS = 45_000;

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  const callAiChat = useCallback(
    async (
      message: string,
      prefs?: { allergies: string[]; mood: string },
      retryWithoutSession = false
    ) => {
      const aiContextToken = resolveGuestAiContextToken(token, sessionToken);
      if (!aiContextToken) {
        throw new Error(tUI("ai.overlay.unavailable"));
      }

      const sessionId = retryWithoutSession
        ? undefined
        : (aiSessionId ??
          readAiSessionIdForGuest(locationId, token, [sessionToken]) ??
          undefined);

      const controller = new AbortController();
      const timeoutId = window.setTimeout(
        () => controller.abort(),
        CHAT_FETCH_TIMEOUT_MS
      );

      let res: Response;
      try {
        res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            locationId,
            tableId,
            sessionToken: aiContextToken,
            message,
            language,
            sessionId,
            preferences: prefs ?? preferencesRef.current,
            includeOrderContext: true,
            allowOrdering: !orderingDisabled,
            browsingContext: resolveScrollContext?.() ?? undefined,
            manualCartSnapshot: getManualCartSnapshot?.() ?? undefined,
          }),
        });
      } catch (fetchError) {
        if (fetchError instanceof Error && fetchError.name === "AbortError") {
          throw new Error(tUI("ai.overlay.error"));
        }
        throw fetchError;
      } finally {
        window.clearTimeout(timeoutId);
      }

      const json = (await res.json()) as {
        error?: string;
        details?: { code?: string };
        data?: {
          message: string;
          recommendations: ProductRecommendation[];
          cartActions?: ValidatedCartAction[];
          quickReplies?: string[];
          submitOrder?: boolean;
          sessionId: string;
        };
      };

      if (!res.ok) {
        if (
          !retryWithoutSession &&
          (res.status === 401 || res.status === 404) &&
          sessionId
        ) {
          clearAiSessionIdForGuest(locationId, token, [sessionToken, aiContextToken]);
          setAiSessionId(null);
          return callAiChat(message, prefs, true);
        }

        throw new Error(
          mapAiChatError(json.error, res.status, json.details, tUI)
        );
      }

      const data = json.data!;

      if (data.sessionId) {
        writeAiSessionIdForGuest(locationId, token, data.sessionId);
        setAiSessionId(data.sessionId);
      }

      return data;
    },
    [
      token,
      sessionToken,
      aiSessionId,
      locationId,
      tableId,
      language,
      tUI,
      resolveScrollContext,
      orderingDisabled,
      getManualCartSnapshot,
    ]
  );

  const applyCartActions = useCallback(
    (actions: ValidatedCartAction[] | undefined) => {
      if (orderingDisabled || !actions?.length) return;

      for (const action of actions) {
        hapticClick();
        addItem({
          productId: action.productId,
          productName: action.productName,
          unitPrice: action.unitPrice,
          quantity: action.quantity,
          notes: action.notes,
          serveSize: action.serveSize,
          menuSection: action.menuSection,
          productTaxRate: action.productTaxRate,
          modifiers: action.modifiers,
        });
      }

      const total = actions.reduce((sum, action) => sum + action.lineTotal, 0);
      const label =
        actions.length === 1
          ? actions[0].productName
          : tUI("ai.order.addedMultiple", { count: String(actions.length) });
      toastAddedToCart(label, total, currency);
    },
    [orderingDisabled, addItem, currency, tUI]
  );

  const trySubmitOrder = useCallback(
    async (sessionId: string): Promise<string | null> => {
      if (orderingDisabled || isDemo) return null;

      const aiContextToken = resolveGuestAiContextToken(token, sessionToken);
      if (!aiContextToken) return null;

      try {
        const res = await fetch("/api/ai/order/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            locationId,
            tableId,
            tableToken: token,
            sessionToken: sessionToken ?? undefined,
            deviceFingerprint: getOrCreateDeviceFingerprint(),
            deviceToken:
              getStoredDeviceToken(locationId, tableId) ?? undefined,
          }),
        });

        const json = (await res.json()) as {
          error?: string;
          data?: {
            orderId: string;
            orderNumber: number;
            awaitingApproval?: boolean;
          };
        };

        if (!res.ok || !json.data) {
          return json.error ?? tUI("ai.order.submitFailed");
        }

        clearCart();
        hapticSuccess();
        recordGuestOrderPlaced();

        if (json.data.awaitingApproval) {
          return tUI("ai.order.submitApproval", {
            number: String(json.data.orderNumber),
          });
        }

        return tUI("ai.order.submitSuccess", {
          number: String(json.data.orderNumber),
        });
      } catch {
        return tUI("ai.order.submitFailed");
      }
    },
    [
      orderingDisabled,
      isDemo,
      token,
      sessionToken,
      locationId,
      tableId,
      clearCart,
      tUI,
    ]
  );

  const appendStatusMessage = useCallback((message: string) => {
    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: "assistant", content: message },
    ]);
  }, []);

  useAiOrderStatus({
    enabled: open && !orderingDisabled && !!sessionToken && phase === "chat",
    tableToken: token,
    sessionToken,
    tUI,
    onStatusMessage: appendStatusMessage,
  });

  const sendUserMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isTyping || phase !== "chat") return;

      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: "user", content: trimmed },
      ]);
      setIsTyping(true);

      try {
        if (isDemo) {
          const demo = getDemoAiChatResponse(trimmed, menuCategories);
          setMessages((prev) => [
            ...prev,
            {
              id: nextId(),
              role: "assistant",
              content: tUI(demo.messageKey),
              recommendations: demo.recommendations.length
                ? demo.recommendations
                : undefined,
            },
          ]);
          return;
        }

        const data = await callAiChat(trimmed);
        applyCartActions(data.cartActions);

        if (data.submitOrder && data.sessionId) {
          const submitMessage = await trySubmitOrder(data.sessionId);
          setMessages((prev) => [
            ...prev,
            {
              id: nextId(),
              role: "assistant",
              content:
                submitMessage ??
                tUI("ai.order.submitFailed"),
            },
          ]);
          return;
        }

        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: "assistant",
            content: data.message,
            recommendations: data.recommendations?.length
              ? data.recommendations
              : undefined,
          },
        ]);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: "assistant",
            content:
              err instanceof Error ? err.message : tUI("ai.overlay.error"),
          },
        ]);
      } finally {
        setIsTyping(false);
      }
    },
    [
      isTyping,
      phase,
      isDemo,
      menuCategories,
      callAiChat,
      applyCartActions,
      trySubmitOrder,
      tUI,
    ]
  );

  const handleQuickReply = useCallback(
    (messageId: string, label: string) => {
      setMessages((prev) =>
        prev.map((message) =>
          message.id === messageId
            ? { ...message, quickRepliesUsed: true }
            : message
        )
      );
      void sendUserMessage(label);
    },
    [sendUserMessage]
  );

  const handleAddRecommendation = useCallback(
    (rec: ProductRecommendation) => {
      if (orderingDisabled) return;

      if (
        customizableProductIds?.has(rec.productId) &&
        onOpenProductDetail
      ) {
        hapticClick();
        onOpenProductDetail(rec.productId);
        return;
      }

      if (onAddToCart) {
        hapticClick();
        onAddToCart(rec);
        setAddedIds((prev) => new Set(prev).add(rec.productId));
        return;
      }

      hapticClick();
      const section = menuSectionByProductId?.get(rec.productId) ?? "food";
      addItem({
        productId: rec.productId,
        productName: rec.name,
        unitPrice: rec.price,
        quantity: 1,
        notes: "",
        menuSection: section,
        productTaxRate: productTaxRateById?.get(rec.productId) ?? null,
        modifiers: [],
      });
      toastAddedToCart(rec.name, rec.price, currency);
      setAddedIds((prev) => new Set(prev).add(rec.productId));

      if (aiSessionId) {
        void trackAiConversion({
          sessionId: aiSessionId,
          productId: rec.productId,
          locationId,
          tableId,
          sessionToken: resolveGuestAiContextToken(token, sessionToken),
        });
      }
    },
    [
      orderingDisabled,
      menuSectionByProductId,
      productTaxRateById,
      addItem,
      currency,
      aiSessionId,
      sessionToken,
      locationId,
      tableId,
      onAddToCart,
      customizableProductIds,
      onOpenProductDetail,
    ]
  );

  const handleQuickPickConfirm = useCallback(
    (messageId: string, ids: string[]) => {
      if (phase === "allergies") {
        const selection = ids as AiSheetAllergyId[];
        allergySelectionRef.current = selection;
        const prefs = apiPreferencesFromSheet({
          allergies: selection,
          mood: null,
        });
        preferencesRef.current = prefs;
        const labels = selection
          .map(
            (id) =>
              allergyOptions.find((o) => o.id === id)?.label ?? id
          )
          .join(", ");

        setMessages((prev) =>
          prev
            .map((m) =>
              m.id === messageId && m.quickPicks
                ? {
                    ...m,
                    quickPicks: { ...m.quickPicks, confirmed: true },
                  }
                : m
            )
            .concat(
              {
                id: nextId(),
                role: "user",
                content: labels,
              },
              {
                id: nextId(),
                role: "assistant",
                content: tUI("ai.chat.moodQuestion"),
                quickPicks: {
                  options: moodOptions,
                  mode: "single",
                  confirmed: false,
                },
              }
            )
        );
        setPhase("mood");
        return;
      }

      if (phase === "mood") {
        const moodId = ids[0] as AiSheetMoodId | undefined;
        const label =
          moodOptions.find((o) => o.id === moodId)?.label ?? ids[0] ?? "";

        const prefs = apiPreferencesFromSheet({
          allergies: allergySelectionRef.current,
          mood: moodId ?? null,
        });
        preferencesRef.current = prefs;
        onSaveAllergies?.(prefs.allergies, allergySelectionRef.current);

        setMessages((prev) =>
          prev
            .map((m) =>
              m.id === messageId && m.quickPicks
                ? {
                    ...m,
                    quickPicks: { ...m.quickPicks, confirmed: true },
                  }
                : m
            )
            .concat(
              {
                id: nextId(),
                role: "user",
                content: label,
              },
              {
                id: nextId(),
                role: "assistant",
                content: tUI("ai.chat.welcome"),
              }
            )
        );
        setPhase("chat");
      }
    },
    [
      phase,
      allergyOptions,
      moodOptions,
      tUI,
      onSaveAllergies,
    ]
  );

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isTyping || phase !== "chat") return;
    setInput("");
    await sendUserMessage(text);
  }

  if (!open) return null;

  const inputEnabled = phase === "chat";
  const canSend = inputEnabled && !isTyping && input.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950 text-zinc-50">
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-800/80 bg-zinc-950/80 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 animate-pulse text-orange-400" />
          <h2 className="text-base font-semibold text-zinc-50">
            {tUI("ai.intro.title")}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="touch-target inline-flex size-10 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          aria-label={tUI("ai.chat.close")}
        >
          <X className="size-5" />
        </button>
      </header>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4"
      >
        {messages.map((message) => (
          <ChatBubble
            key={message.id}
            message={message}
            currency={currency}
            orderingDisabled={orderingDisabled}
            addedIds={addedIds}
            continueLabel={tUI("ai.chat.continue")}
            onQuickPickConfirm={
              message.quickPicks && !message.quickPicks.confirmed
                ? handleQuickPickConfirm
                : undefined
            }
            onQuickReply={undefined}
            onAddRecommendation={handleAddRecommendation}
          />
        ))}
        {isTyping && (
          <div className="flex gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-orange-400">
              <Sparkles className="size-4" />
            </span>
            <div className="rounded-2xl bg-zinc-900">
              <ChatTypingIndicator />
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={handleSend}
        className="shrink-0 border-t border-zinc-800 bg-zinc-950 px-4 pt-3 pb-safe"
      >
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={!inputEnabled}
            placeholder={
              orderingDisabled
                ? tUI("ai.chat.placeholder")
                : tUI("ai.chat.orderPlaceholder")
            }
            className="min-w-0 flex-1 rounded-full border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-zinc-600 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!canSend}
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={tUI("ai.chat.send")}
          >
            <Send className="size-5" />
          </button>
        </div>
      </form>
    </div>
  );
}
