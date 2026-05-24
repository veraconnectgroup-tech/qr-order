"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Send, Sparkles, X, Check } from "lucide-react";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import type { ProductRecommendation } from "@/components/guest/product-recommendation-card";
import type { MenuCategory } from "@/components/guest/menu-grid";
import { getDemoAiRecommendations, getDemoAiChatResponse } from "@/lib/demo-ai";
import {
  AI_SHEET_ALLERGY_OPTIONS,
  AI_SHEET_MOOD_OPTIONS,
  allergenIdsFromSheetSelections,
  apiPreferencesFromSheet,
  buildSmartMenuPrompt,
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
import { toastAddedToCart } from "@/lib/cart-toast";
import { formatPrice } from "@/lib/format";
import { hapticClick } from "@/lib/haptics";
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
  recommendations?: ProductRecommendation[];
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
  if (status === 429) {
    return tUI("ai.overlay.rateLimited");
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

function ChatRecommendationCards({
  recommendations,
  currency,
  orderingDisabled,
  addedIds,
  onAdd,
  addLabel,
  addedLabel,
}: {
  recommendations: ProductRecommendation[];
  currency: string;
  orderingDisabled: boolean;
  addedIds: Set<string>;
  onAdd: (rec: ProductRecommendation) => void;
  addLabel: string;
  addedLabel: string;
}) {
  if (!recommendations.length) return null;

  return (
    <div className="-mx-1 mt-3 flex gap-3 overflow-x-auto px-1 pb-1 snap-x snap-mandatory">
      {recommendations.map((rec) => {
        const added = addedIds.has(rec.productId);
        return (
          <div
            key={rec.productId}
            className="w-44 shrink-0 snap-start overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950"
          >
            <div className="relative h-20 w-full bg-zinc-800">
              {rec.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={rec.imageUrl}
                  alt={rec.name}
                  className="size-full object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900">
                  <Sparkles className="size-5 text-zinc-600" />
                </div>
              )}
            </div>
            <div className="space-y-2 p-2.5">
              <p className="truncate text-sm font-semibold text-zinc-100">
                {rec.name}
              </p>
              <p className="text-xs font-bold text-orange-500">
                {formatPrice(rec.price, currency)}
              </p>
              {rec.reason && (
                <p className="line-clamp-2 text-[11px] leading-snug text-zinc-500">
                  {rec.reason}
                </p>
              )}
              <button
                type="button"
                disabled={orderingDisabled || added}
                onClick={() => onAdd(rec)}
                className={cn(
                  "flex w-full items-center justify-center gap-1 rounded-lg py-2 text-xs font-semibold transition",
                  added
                    ? "bg-zinc-800 text-zinc-400"
                    : "bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50"
                )}
              >
                {added ? (
                  <>
                    <Check className="size-3.5" />
                    {addedLabel}
                  </>
                ) : (
                  addLabel
                )}
              </button>
            </div>
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
  onAddRecommendation,
  continueLabel,
  addLabel,
  addedLabel,
}: {
  message: ChatMessage;
  currency: string;
  orderingDisabled: boolean;
  addedIds: Set<string>;
  onQuickPickConfirm?: (messageId: string, ids: string[]) => void;
  onAddRecommendation: (rec: ProductRecommendation) => void;
  continueLabel: string;
  addLabel: string;
  addedLabel: string;
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
        {message.recommendations && (
          <ChatRecommendationCards
            recommendations={message.recommendations}
            currency={currency}
            orderingDisabled={orderingDisabled}
            addedIds={addedIds}
            onAdd={onAddRecommendation}
            addLabel={addLabel}
            addedLabel={addedLabel}
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
  /** Alias for onSetupComplete */
  onRecommendations?: AiConciergeChatProps["onSetupComplete"];
  welcomeBackMessage?: string | null;
  knownAllergySelection?: AiSheetAllergyId[];
  onSaveAllergies?: (
    allergies: string[],
    sheetIds: AiSheetAllergyId[]
  ) => void;
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
  onRecommendations,
  welcomeBackMessage,
  knownAllergySelection,
  onSaveAllergies,
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

    if (hasKnownAllergies) {
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
        content: tUI("ai.chat.moodQuestion"),
        quickPicks: {
          options: moodOptions,
          mode: "single",
          confirmed: false,
        },
      });
      setMessages(initialMessages);
      setPhase("mood");
    } else if (resolvedWelcomeMessage) {
      setMessages([
        {
          id: nextId(),
          role: "assistant",
          content: resolvedWelcomeMessage,
        },
        {
          id: nextId(),
          role: "assistant",
          content: tUI("ai.chat.welcome"),
          quickPicks: {
            options: allergyOptions,
            mode: "multi",
            confirmed: false,
          },
        },
      ]);
      setPhase("allergies");
    } else {
      setMessages([
        {
          id: nextId(),
          role: "assistant",
          content: tUI("ai.chat.welcome"),
          quickPicks: {
            options: allergyOptions,
            mode: "multi",
            confirmed: false,
          },
        },
      ]);
      setPhase("allergies");
    }

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
            browsingContext: resolveScrollContext?.() ?? undefined,
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
    ]
  );

  const handleAddRecommendation = useCallback(
    (rec: ProductRecommendation) => {
      if (orderingDisabled) return;

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
    ]
  );

  const fetchInitialRecommendations = useCallback(
    async (selections: AiSheetSelections) => {
      setIsTyping(true);
      try {
        const prefs = apiPreferencesFromSheet(selections);
        preferencesRef.current = prefs;
        onSaveAllergies?.(prefs.allergies, selections.allergies);

        let recommendations: ProductRecommendation[] = [];
        let sessionId: string | null = aiSessionId;

        if (isDemo) {
          await new Promise((r) => window.setTimeout(r, 700));
          recommendations = getDemoAiRecommendations(menuCategories, selections);
          setMessages((prev) => [
            ...prev,
            {
              id: nextId(),
              role: "assistant",
              content: recommendations[0]?.reason ?? tUI("ai.smart.recommendedTitle"),
              recommendations,
            },
          ]);
        } else {
          const data = await callAiChat(
            buildSmartMenuPrompt(selections),
            prefs
          );
          recommendations = data.recommendations;
          sessionId = data.sessionId ?? sessionId;
          setMessages((prev) => [
            ...prev,
            {
              id: nextId(),
              role: "assistant",
              content: data.message,
              recommendations,
            },
          ]);
        }

        setPhase("chat");
        handleRecommendations?.({
          recommendations,
          sessionId,
          preferences: prefs,
          allergenIds: allergenIdsFromSheetSelections(selections.allergies),
        });
      } catch (e) {
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: "assistant",
            content:
              e instanceof Error ? e.message : tUI("ai.overlay.error"),
          },
        ]);
        setPhase("chat");
      } finally {
        setIsTyping(false);
      }
    },
    [
      aiSessionId,
      isDemo,
      menuCategories,
      callAiChat,
      handleRecommendations,
      onSaveAllergies,
      tUI,
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
            .concat({
              id: nextId(),
              role: "user",
              content: label,
            })
        );

        void fetchInitialRecommendations({
          allergies: allergySelectionRef.current,
          mood: moodId ?? null,
        });
      }
    },
    [
      phase,
      allergyOptions,
      moodOptions,
      tUI,
      fetchInitialRecommendations,
    ]
  );

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isTyping || phase !== "chat") return;

    setInput("");
    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: "user", content: text },
    ]);
    setIsTyping(true);

    try {
      if (isDemo) {
        const demo = getDemoAiChatResponse(text, menuCategories);
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

      const data = await callAiChat(text);
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: "assistant",
          content: data.message,
          recommendations: data.recommendations,
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
            onAddRecommendation={handleAddRecommendation}
            addLabel={tUI("ai.recommendation.add")}
            addedLabel={tUI("ai.recommendation.added")}
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
              phase === "chat"
                ? tUI("ai.chat.placeholder")
                : tUI("ai.chat.setupHint")
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
