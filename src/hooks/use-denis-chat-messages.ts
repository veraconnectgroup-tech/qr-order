"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { CartItem } from "@/hooks/use-cart";
import type { ProductRecommendation } from "@/components/guest/product-recommendation-card";
import type { MenuCategory } from "@/components/guest/menu-grid";
import { ERROR_CODES, parseApiErrorFromJson } from "@/lib/api-error-client";
import { resolveAiPromptLanguage } from "@/lib/ai/config";
import { resolveStickyGuestLanguage, tForAiGuestLanguage } from "@/lib/ai/guest-language";
import {
  clearGuestRecoveryFailureCount,
  GuestRecoveryError,
  GuestRetryableChatError,
  isInfrastructureChatError,
  tryLocalGuestAnswer,
} from "@/lib/guest/denis-guest-recovery";
import type { DenisGuestApiMeta } from "@/lib/denis/surfaces/format-denis-api-meta";
import { getDemoAiChatResponse } from "@/lib/demo-ai";
import {
  apiPreferencesFromSheet,
  type AiSheetAllergyId,
  type AiSheetMoodId,
} from "@/lib/ai/guest-sheet-preferences";
import {
  clearAiSessionIdForGuest,
  readAiSessionIdForGuest,
  resolveGuestAiContextToken,
  writeAiSessionIdForGuest,
} from "@/lib/ai/guest-ai-token";
import {
  completeAiSession,
  trackAiConversion,
} from "@/lib/ai/guest-session-storage";
import { getStoredDeviceToken } from "@/lib/guest/device-storage";
import {
  applyDenisOrderSessionOpened,
  pollDenisApprovalPin,
  type DenisOrderSubmitPayload,
} from "@/lib/guest/apply-denis-order-submit";
import { recordGuestOrderPlaced } from "@/lib/pwa/install-timing";
import { toastAddedToCart } from "@/lib/cart-toast";
import { hapticClick, hapticSuccess } from "@/lib/haptics";
import type { MenuSection } from "@/lib/menu-section";
import {
  postDenisMessageTurn,
  postDenisThinkingPreview,
} from "@/lib/guest/denis-signal-client";
import type { TranscriptEntry } from "@/lib/denis/loop/view-types";
import { useOnlineStatus } from "@/hooks/use-online-status";
import {
  isDenisChatAllowedOffline,
  offlineGuestMessage,
  resolveOfflineMode,
} from "@/lib/offline/service-worker";
import type { DenisChatRecovery } from "@/hooks/use-denis-chat-recovery";
import type { DenisChatSession } from "@/hooks/use-denis-chat-session";
import type { SceneSituation } from "@/lib/scene/types";
import {
  aiLegacySessionTokens,
  CHAT_FETCH_TIMEOUT_MS,
  chatMessagesFromViewTranscript,
  formatDenisPinMessage,
  isStaleAiSessionResponse,
  mapAiChatError,
  nextChatMessageId,
  type ChatMessage,
  type TurnExtras,
  type ValidatedCartAction,
} from "@/components/guest/denis-chat/types";

export function useDenisChatMessages(input: {
  open: boolean;
  isDemo: boolean;
  slug: string;
  token: string;
  locationId: string;
  tableId: string;
  sessionToken: string | null;
  currency: string;
  taxPercent: number;
  orderingDisabled: boolean;
  menuLocale: string;
  venueGreeting: string;
  isReturning?: boolean;
  onWelcomeDismiss?: () => void;
  onRecoveryFailure?: (failureCount: number) => void;
  menuCategories: MenuCategory[];
  resolvedAllergySelection: AiSheetAllergyId[];
  bootstrapTranscript?: TranscriptEntry[] | null;
  sceneSituation?: SceneSituation | null;
  tableName: string;
  deviceFingerprint: string;
  resolveScrollContext?: () => string | null;
  onOpenPaymentSheet?: () => void;
  onViewRefresh?: () => void;
  onSaveAllergies?: (allergies: string[], sheetIds: AiSheetAllergyId[]) => void;
  menuSectionByProductId?: Map<string, MenuSection>;
  productTaxRateById?: Map<string, number | null>;
  onAddToCart?: (rec: ProductRecommendation) => void;
  customizableProductIds?: Set<string>;
  onOpenProductDetail?: (productId: string) => void;
  cartItemsLength: number;
  cartTotal: number;
  addItem: (item: Omit<CartItem, "itemTotal">) => void;
  clearCart: () => void;
  tUI: (key: string, vars?: Record<string, string | number>) => string;
  session: DenisChatSession;
  recovery: DenisChatRecovery;
  voiceSpeak: (text: string) => void;
}) {
  const isOnline = useOnlineStatus();
  const chatWasOpenRef = useRef(false);
  const approvalPollCleanupRef = useRef<(() => void) | null>(null);
  const pendingTurnExtrasRef = useRef<TurnExtras | null>(null);
  const usedQuickReplyIdsRef = useRef<Set<string>>(new Set());
  const pendingRetryRef = useRef(
    new Map<string, { userMessage: string; tryAgainLabel: string }>()
  );

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [pendingThinkingMessage, setPendingThinkingMessage] = useState<
    string | null
  >(null);
  const [serverThinkingSteps, setServerThinkingSteps] = useState<string[]>([]);
  const [addedIds, setAddedIds] = useState<Set<string>>(() => new Set());

  const { addItem } = input;
  const {
    chatLanguage,
    setChatLanguage,
    aiSessionId,
    setAiSessionId,
    phase,
    setPhase,
    preferencesRef,
    allergySelectionRef,
    allergyOptions,
    moodOptions,
    tChat,
    syncPreferencesFromSelection,
  } = input.session;

  useEffect(() => {
    return () => {
      approvalPollCleanupRef.current?.();
      approvalPollCleanupRef.current = null;
    };
  }, []);

  const handleDenisOrderSubmit = useCallback(
    (payload: DenisOrderSubmitPayload) => {
      if (payload.sessionOpened) {
        applyDenisOrderSessionOpened({
          slug: input.slug,
          tableToken: input.token,
          locationId: input.locationId,
          tableId: input.tableId,
          tableName: input.tableName,
          sessionOpened: payload.sessionOpened,
        });
      }

      const appendPinMessage = (tablePin: string) => {
        setMessages((prev) => [
          ...prev,
          {
            id: nextChatMessageId(),
            role: "assistant",
            content: formatDenisPinMessage(tChat, tablePin),
            ephemeral: true,
          },
        ]);
      };

      if (payload.sessionOpened?.tablePin) {
        appendPinMessage(payload.sessionOpened.tablePin);
        return;
      }

      if (!payload.awaitingApproval) return;

      approvalPollCleanupRef.current?.();
      approvalPollCleanupRef.current = pollDenisApprovalPin({
        orderId: payload.orderId,
        tableToken: input.token,
        slug: input.slug,
        locationId: input.locationId,
        tableId: input.tableId,
        tableName: input.tableName,
        onPin: appendPinMessage,
        onRejected: (reason) => {
          setMessages((prev) => [
            ...prev,
            {
              id: nextChatMessageId(),
              role: "assistant",
              content:
                reason ?? tForAiGuestLanguage("session.approvalRejected", chatLanguage),
              ephemeral: true,
            },
          ]);
        },
      });
    },
    [
      input.slug,
      input.token,
      input.locationId,
      input.tableId,
      input.tableName,
      chatLanguage,
      tChat,
    ]
  );

  useEffect(() => {
    const justOpened = input.open && !chatWasOpenRef.current;
    chatWasOpenRef.current = input.open;

    if (!input.open || input.isDemo) return;

    if (justOpened) {
      setPhase("chat");
      setIsTyping(false);
      setAddedIds(new Set());
    }

    syncPreferencesFromSelection(input.resolvedAllergySelection);

    if (justOpened && !input.bootstrapTranscript?.length) {
      setMessages((prev) => {
        if (prev.length > 0) return prev;
        if (input.isReturning) {
          return [
            {
              id: nextChatMessageId(),
              role: "assistant",
              content: input.venueGreeting,
            },
          ];
        }
        return [];
      });
      setChatLanguage(resolveAiPromptLanguage(input.menuLocale));
    }
  }, [
    input.open,
    input.isDemo,
    input.venueGreeting,
    input.menuLocale,
    input.resolvedAllergySelection,
    input.bootstrapTranscript,
    input.isReturning,
    setChatLanguage,
    setPhase,
    syncPreferencesFromSelection,
  ]);

  useEffect(() => {
    if (!input.open || input.isDemo || phase !== "chat") return;
    if (!input.bootstrapTranscript?.length) return;

    setMessages((prev) =>
      chatMessagesFromViewTranscript(input.bootstrapTranscript!, {
        turnExtras: pendingTurnExtrasRef.current,
        usedQuickReplyIds: usedQuickReplyIdsRef.current,
        ephemeral: prev,
      })
    );
    pendingTurnExtrasRef.current = null;
  }, [input.bootstrapTranscript, input.open, input.isDemo, phase]);

  const callAiChat = useCallback(
    async (
      message: string,
      prefs?: { allergies: string[]; mood: string },
      retryWithoutSession = false,
      inputSurface: "chat" | "voice" = "chat"
    ) => {
      const aiContextToken = resolveGuestAiContextToken(
        input.token,
        input.sessionToken
      );
      if (!aiContextToken) {
        throw new Error(tChat("ai.overlay.unavailable"));
      }

      const legacyTokens = aiLegacySessionTokens(input.tableId, input.sessionToken);
      const sessionId = retryWithoutSession
        ? undefined
        : (aiSessionId ??
          readAiSessionIdForGuest(input.locationId, input.token, legacyTokens) ??
          undefined);

      const controller = new AbortController();
      const timeoutId = window.setTimeout(
        () => controller.abort(),
        CHAT_FETCH_TIMEOUT_MS
      );

      const requestLanguage = resolveStickyGuestLanguage(
        message,
        input.menuLocale,
        chatLanguage
      );

      let res: Response;
      try {
        res = await postDenisMessageTurn(
          {
            tableToken: input.token,
            tableSessionToken: input.sessionToken ?? undefined,
            locationId: input.locationId,
            tableId: input.tableId,
            message,
            language: requestLanguage,
            aiSessionId: sessionId,
            preferences: prefs ?? preferencesRef.current,
            includeOrderContext: true,
            allowOrdering: !input.orderingDisabled,
            browsingContext: input.resolveScrollContext?.() ?? undefined,
            deviceFingerprint: input.deviceFingerprint,
            deviceToken:
              getStoredDeviceToken(input.locationId, input.tableId) ?? undefined,
            surface: inputSurface,
          },
          { signal: controller.signal }
        );
      } catch (fetchError) {
        if (fetchError instanceof Error && fetchError.name === "AbortError") {
          const failureCount = input.recovery.bumpFailureCount();
          throw new GuestRecoveryError(
            input.recovery.buildRecovery(message, failureCount, requestLanguage)
          );
        }
        throw fetchError;
      } finally {
        window.clearTimeout(timeoutId);
      }

      const json = (await res.json()) as {
        ok?: boolean;
        error?: string | { code?: string; message?: string; retryable?: boolean };
        details?: { code?: string };
        data?: {
          message: string;
          recommendations: ProductRecommendation[];
          cartActions?: ValidatedCartAction[];
          quickReplies?: string[];
          submitOrder?: boolean;
          sessionId: string;
          voice?: { speakText: string; ttsRecommended: boolean };
          denis?: DenisGuestApiMeta;
          orderSubmit?: DenisOrderSubmitPayload;
          openPaymentSheet?: boolean;
        };
      };

      const parsedError = !res.ok
        ? parseApiErrorFromJson(json, res.status)
        : null;

      if (!res.ok) {
        if (
          !retryWithoutSession &&
          isStaleAiSessionResponse(res.status, parsedError, sessionId)
        ) {
          if (sessionId) {
            void completeAiSession({
              sessionId,
              locationId: input.locationId,
              tableId: input.tableId,
              sessionToken: aiContextToken,
            });
          }
          clearAiSessionIdForGuest(input.locationId, input.token, [
            input.sessionToken,
            aiContextToken,
            ...legacyTokens,
          ]);
          setAiSessionId(null);
          return callAiChat(message, prefs, true, inputSurface);
        }

        if (isInfrastructureChatError(parsedError, res.status)) {
          const failureCount = input.recovery.bumpFailureCount();
          throw new GuestRecoveryError(
            input.recovery.buildRecovery(message, failureCount, requestLanguage)
          );
        }

        if (
          parsedError?.retryable &&
          parsedError.code === ERROR_CODES.RATE_LIMITED
        ) {
          throw new GuestRetryableChatError({
            displayMessage: mapAiChatError(parsedError, res.status, tChat),
            retryUserMessage: message,
            tryAgainLabel: tForAiGuestLanguage(
              "ai.overlay.tryAgain",
              requestLanguage
            ),
          });
        }

        throw new Error(mapAiChatError(parsedError, res.status, tChat));
      }

      if (!json.data) {
        const failureCount = input.recovery.bumpFailureCount();
        throw new GuestRecoveryError(
          input.recovery.buildRecovery(message, failureCount, requestLanguage)
        );
      }

      const data = json.data;
      clearGuestRecoveryFailureCount(input.recovery.recoveryScopeKey);

      if (data.sessionId) {
        writeAiSessionIdForGuest(input.locationId, input.token, data.sessionId);
        setAiSessionId(data.sessionId);
      }

      setChatLanguage(requestLanguage);

      return data;
    },
    [
      input.token,
      input.sessionToken,
      aiSessionId,
      input.locationId,
      input.menuLocale,
      chatLanguage,
      input.tableId,
      tChat,
      input.resolveScrollContext,
      input.orderingDisabled,
      input.deviceFingerprint,
      input.recovery,
      setAiSessionId,
      setChatLanguage,
      preferencesRef,
    ]
  );

  const applyCartActions = useCallback(
    (actions: ValidatedCartAction[] | undefined) => {
      if (input.orderingDisabled || !actions?.length) return;

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
          : input.tUI("ai.order.addedMultiple", { count: String(actions.length) });
      toastAddedToCart(label, total, input.currency);
    },
    [input.orderingDisabled, addItem, input.currency, input.tUI]
  );

  const sendUserMessage = useCallback(
    async (
      text: string,
      options?: { inputSurface?: "chat" | "voice" }
    ) => {
      const trimmed = text.trim();
      if (!trimmed || isTyping || phase !== "chat") return;

      input.onWelcomeDismiss?.();

      const offlineMode = resolveOfflineMode({
        navigatorOnline: isOnline,
        hasMenuCache: true,
        pendingOrders: 0,
      });
      if (!isDenisChatAllowedOffline(offlineMode)) {
        const offlineMessage =
          offlineGuestMessage(offlineMode, chatLanguage) ??
          input.tUI("ai.recovery.connection");
        setPendingThinkingMessage(null);
        setIsTyping(false);
        setMessages((prev) => [
          ...prev,
          {
            id: nextChatMessageId(),
            role: "assistant",
            content: offlineMessage,
            ephemeral: true,
          },
        ]);
        return;
      }

      const inputSurface = options?.inputSurface ?? "chat";

      setPendingThinkingMessage(trimmed);
      setServerThinkingSteps([]);
      setIsTyping(true);
      setMessages((prev) => [
        ...prev,
        { id: nextChatMessageId(), role: "user", content: trimmed },
      ]);

      const requestLanguage = resolveStickyGuestLanguage(
        trimmed,
        input.menuLocale,
        chatLanguage
      );

      const legacyTokens = aiLegacySessionTokens(input.tableId, input.sessionToken);
      const previewSessionId =
        aiSessionId ??
        readAiSessionIdForGuest(input.locationId, input.token, legacyTokens) ??
        undefined;

      void postDenisThinkingPreview({
        tableToken: input.token,
        tableSessionToken: input.sessionToken ?? undefined,
        locationId: input.locationId,
        tableId: input.tableId,
        message: trimmed,
        language: requestLanguage,
        aiSessionId: previewSessionId,
        preferences: preferencesRef.current,
        includeOrderContext: true,
        allowOrdering: !input.orderingDisabled,
        browsingContext: input.resolveScrollContext?.() ?? undefined,
        deviceFingerprint: input.deviceFingerprint,
        deviceToken:
          getStoredDeviceToken(input.locationId, input.tableId) ?? undefined,
        surface: inputSurface,
      }).then((preview) => {
        if (preview?.steps?.length) {
          setServerThinkingSteps(preview.steps);
        }
      });

      try {
        if (input.isDemo) {
          const demo = getDemoAiChatResponse(trimmed, input.menuCategories);
          setMessages((prev) => [
            ...prev,
            {
              id: nextChatMessageId(),
              role: "assistant",
              content: input.tUI(demo.messageKey),
              recommendations: demo.recommendations.length
                ? demo.recommendations
                : undefined,
              ephemeral: true,
            },
          ]);
          return;
        }

        const localAnswer = tryLocalGuestAnswer({
          guestMessage: trimmed,
          language: chatLanguage,
          situation: input.sceneSituation,
          cartItemCount: input.cartItemsLength,
          cartTotal: input.cartTotal,
          currency: input.currency,
        });
        if (localAnswer?.answeredLocally) {
          setMessages((prev) => [
            ...prev,
            {
              id: nextChatMessageId(),
              role: "assistant",
              content: localAnswer.message,
              quickReplies: localAnswer.quickReplies,
              ephemeral: true,
            },
          ]);
          void input.recovery.fireRecoveryAction(localAnswer.action);
          return;
        }

        const data = await callAiChat(trimmed, undefined, false, inputSurface);
        applyCartActions(data.cartActions);

        if (data.orderSubmit) {
          input.clearCart();
          hapticSuccess();
          recordGuestOrderPlaced();
          handleDenisOrderSubmit(data.orderSubmit);
        }

        if (data.openPaymentSheet) {
          input.onOpenPaymentSheet?.();
        }

        const assistantText = data.message?.trim();
        if (assistantText) {
          setMessages((prev) => [
            ...prev,
            {
              id: nextChatMessageId(),
              role: "assistant",
              content: assistantText,
              quickReplies: data.quickReplies?.length
                ? data.quickReplies
                : undefined,
              recommendations: data.recommendations?.length
                ? data.recommendations
                : undefined,
            },
          ]);
        } else {
          pendingTurnExtrasRef.current = {
            quickReplies: data.quickReplies?.length ? data.quickReplies : undefined,
            recommendations: data.recommendations?.length
              ? data.recommendations
              : undefined,
          };
        }

        void input.onViewRefresh?.();

        if (
          inputSurface === "voice" &&
          data.voice?.ttsRecommended &&
          data.voice.speakText
        ) {
          input.voiceSpeak(data.voice.speakText);
        }
      } catch (err) {
        if (err instanceof GuestRetryableChatError) {
          const messageId = nextChatMessageId();
          pendingRetryRef.current.set(messageId, {
            userMessage: err.retryUserMessage,
            tryAgainLabel: err.tryAgainLabel,
          });
          setMessages((prev) => [
            ...prev,
            {
              id: messageId,
              role: "assistant",
              content: err.displayMessage,
              quickReplies: [err.tryAgainLabel],
              ephemeral: true,
            },
          ]);
          return;
        }

        const failureCount = input.recovery.bumpFailureCount();
        input.onRecoveryFailure?.(failureCount);
        const recovery =
          err instanceof GuestRecoveryError
            ? err.recovery
            : input.recovery.buildRecovery(
                trimmed,
                failureCount,
                chatLanguage
              );

        if (recovery.tier < 2) {
          setMessages((prev) => [
            ...prev,
            {
              id: nextChatMessageId(),
              role: "assistant",
              content: recovery.message,
              quickReplies: recovery.quickReplies,
              ephemeral: true,
            },
          ]);
        }
        void input.recovery.fireRecoveryAction(recovery.action);
      } finally {
        setIsTyping(false);
        setPendingThinkingMessage(null);
        setServerThinkingSteps([]);
      }
    },
    [
      isTyping,
      phase,
      input,
      chatLanguage,
      aiSessionId,
      callAiChat,
      applyCartActions,
      handleDenisOrderSubmit,
      isOnline,
      preferencesRef,
    ]
  );

  const handleQuickReply = useCallback(
    (messageId: string, label: string) => {
      const retry = pendingRetryRef.current.get(messageId);
      if (retry && label === retry.tryAgainLabel) {
        pendingRetryRef.current.delete(messageId);
        usedQuickReplyIdsRef.current.add(messageId);
        setMessages((prev) =>
          prev.map((message) =>
            message.id === messageId
              ? { ...message, quickRepliesUsed: true }
              : message
          )
        );
        void sendUserMessage(retry.userMessage);
        return;
      }

      usedQuickReplyIdsRef.current.add(messageId);
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
      if (input.orderingDisabled) return;

      if (
        input.customizableProductIds?.has(rec.productId) &&
        input.onOpenProductDetail
      ) {
        hapticClick();
        input.onOpenProductDetail(rec.productId);
        return;
      }

      if (input.onAddToCart) {
        hapticClick();
        input.onAddToCart(rec);
        setAddedIds((prev) => new Set(prev).add(rec.productId));
        return;
      }

      hapticClick();
      const section =
        input.menuSectionByProductId?.get(rec.productId) ?? "food";
      addItem({
        productId: rec.productId,
        productName: rec.name,
        unitPrice: rec.price,
        quantity: 1,
        notes: "",
        menuSection: section,
        productTaxRate: input.productTaxRateById?.get(rec.productId) ?? null,
        modifiers: [],
      });
      toastAddedToCart(rec.name, rec.price, input.currency);
      setAddedIds((prev) => new Set(prev).add(rec.productId));

      if (aiSessionId) {
        void trackAiConversion({
          sessionId: aiSessionId,
          productId: rec.productId,
          locationId: input.locationId,
          tableId: input.tableId,
          sessionToken: resolveGuestAiContextToken(
            input.token,
            input.sessionToken
          ),
        });
      }
    },
    [input, aiSessionId, addItem]
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
          .map((id) => allergyOptions.find((o) => o.id === id)?.label ?? id)
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
                id: nextChatMessageId(),
                role: "user",
                content: labels,
                ephemeral: true,
              },
              {
                id: nextChatMessageId(),
                role: "assistant",
                content: input.tUI("ai.chat.moodQuestion"),
                quickPicks: {
                  options: moodOptions,
                  mode: "single",
                  confirmed: false,
                },
                ephemeral: true,
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
        input.onSaveAllergies?.(prefs.allergies, allergySelectionRef.current);

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
                id: nextChatMessageId(),
                role: "user",
                content: label,
                ephemeral: true,
              },
              {
                id: nextChatMessageId(),
                role: "assistant",
                content: input.tUI("ai.chat.welcome"),
                ephemeral: true,
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
      input.tUI,
      input.onSaveAllergies,
      allergySelectionRef,
      preferencesRef,
      setPhase,
    ]
  );

  return {
    messages,
    isTyping,
    pendingThinkingMessage,
    serverThinkingSteps,
    addedIds,
    phase,
    sendUserMessage,
    handleQuickReply,
    handleAddRecommendation,
    handleQuickPickConfirm,
    tChat,
    chatLanguage,
  };
}
