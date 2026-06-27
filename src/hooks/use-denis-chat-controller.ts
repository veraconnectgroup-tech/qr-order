"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type { AiConciergeChatProps } from "@/components/guest/denis-chat/props";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import { useCart } from "@/hooks/use-cart";
import { useDenisChatMessages } from "@/hooks/use-denis-chat-messages";
import { useDenisChatOverlayEffects } from "@/hooks/use-denis-chat-overlay-effects";
import { useDenisChatRecovery } from "@/hooks/use-denis-chat-recovery";
import { useDenisChatSession } from "@/hooks/use-denis-chat-session";
import { useDenisVoice } from "@/hooks/use-denis-voice";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { tForAiGuestLanguage } from "@/lib/ai/guest-language";
import { getOrCreateDeviceFingerprint } from "@/lib/guest/device-storage";
import { requestGuestWaiterCall } from "@/lib/guest/request-waiter-call";
import {
  resolveDenisThinkingStepKeys,
  useRotatingThinkingLabel,
} from "@/lib/guest/denis-thinking-steps";
import { resolveDenisFallbackLevel } from "@/components/guest/denis-fallback-messages";
import {
  isDenisChatAllowedOffline,
  resolveOfflineMode,
} from "@/lib/offline/service-worker";

export function useDenisChatController(props: AiConciergeChatProps) {
  const {
    open,
    onOpenChange,
    slug,
    token,
    locationId,
    tableId,
    sessionToken,
    currency,
    taxPercent,
    orderingDisabled = false,
    isDemo = false,
    menuCategories = [],
    menuSectionByProductId,
    productTaxRateById,
    getBrowsingContext,
    scrollContext,
    guestProfile,
    isReturning = false,
    onAddToCart,
    customizableProductIds,
    onOpenProductDetail,
    knownAllergySelection,
    onSaveAllergies,
    deviceFingerprint,
    voiceEnabled = false,
    voiceTtsEnabled = true,
    sceneChrome = null,
    bootstrapTranscript = null,
    onOpenPaymentSheet,
    onViewRefresh,
  } = props;

  const { tUI, menuLocale } = useAppLocale();
  const isOnline = useOnlineStatus();
  const resolveScrollContext = scrollContext ?? getBrowsingContext;
  const resolvedDeviceFingerprint = useMemo(
    () => deviceFingerprint ?? getOrCreateDeviceFingerprint(),
    [deviceFingerprint]
  );
  const resolvedAllergySelection =
    guestProfile?.allergySheetIds?.length
      ? guestProfile.allergySheetIds
      : (knownAllergySelection ?? []);
  const venueGreeting = useMemo(
    () => tForAiGuestLanguage("ai.chat.greeting", menuLocale),
    [menuLocale]
  );
  const tableName = sceneChrome?.tableName ?? "";
  const recoveryScopeKey = `${locationId}:${token}:${sessionToken ?? "anon"}`;

  const addItem = useCart((s) => s.addItem);
  const cartItems = useCart((s) => s.items);
  const cartTotal = useCart((s) => s.total(false, taxPercent));
  const clearCart = useCart((s) => s.clearCart);

  const scrollRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatWasOpenRef = useRef(false);

  const [input, setInput] = useState("");
  const [inputFocused, setInputFocused] = useState(false);
  const [cartAnnouncement, setCartAnnouncement] = useState("");
  const [welcomeVisible, setWelcomeVisible] = useState(false);
  const [recoveryFailureCount, setRecoveryFailureCount] = useState(0);

  const session = useDenisChatSession({
    menuLocale,
    tUI,
    resolvedAllergySelection,
  });

  const recovery = useDenisChatRecovery({
    recoveryScopeKey,
    token,
    sessionToken,
    locationId,
    tableId,
    currency,
    cartItemCount: cartItems.length,
    cartTotal,
    situation: sceneChrome?.situation,
    tUI,
    onOpenPaymentSheet,
  });

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    });
  }, []);

  const voice = useDenisVoice({
    enabled: voiceEnabled && open,
    language: session.chatLanguage,
    autoSpeak: voiceTtsEnabled,
  });

  const chat = useDenisChatMessages({
    open,
    isDemo,
    slug,
    token,
    locationId,
    tableId,
    sessionToken,
    currency,
    taxPercent,
    orderingDisabled,
    menuLocale,
    venueGreeting,
    isReturning,
    menuCategories,
    resolvedAllergySelection,
    bootstrapTranscript,
    sceneSituation: sceneChrome?.situation,
    tableName,
    deviceFingerprint: resolvedDeviceFingerprint,
    resolveScrollContext,
    onOpenPaymentSheet,
    onViewRefresh,
    onSaveAllergies,
    menuSectionByProductId,
    productTaxRateById,
    onAddToCart,
    customizableProductIds,
    onOpenProductDetail,
    cartItemsLength: cartItems.length,
    cartTotal,
    addItem,
    clearCart,
    tUI,
    session,
    recovery,
    voiceSpeak: voice.speak,
    onWelcomeDismiss: () => setWelcomeVisible(false),
    onRecoveryFailure: setRecoveryFailureCount,
  });

  useDenisChatOverlayEffects({
    open,
    inputFocused,
    messagesLength: chat.messages.length,
    isTyping: chat.isTyping,
    overlayRef,
    scrollToBottom,
  });

  useEffect(() => {
    if (cartItems.length === 0) return;
    setCartAnnouncement(
      tUI("a11y.cartUpdated", {
        count: cartItems.length,
        total: cartTotal.toFixed(2),
      })
    );
  }, [cartItems.length, cartTotal, tUI]);

  useEffect(() => {
    const justOpened = open && !chatWasOpenRef.current;
    chatWasOpenRef.current = open;

    if (!open) {
      setInputFocused(false);
      return;
    }

    if (justOpened && !isDemo) {
      setRecoveryFailureCount(0);
      setWelcomeVisible(!isReturning && !bootstrapTranscript?.length);
      setInput("");
    }
  }, [open, isDemo, isReturning, bootstrapTranscript]);

  const offlineBlocked = useMemo(() => {
    const mode = resolveOfflineMode({
      navigatorOnline: isOnline,
      hasMenuCache: true,
      pendingOrders: 0,
    });
    return !isDenisChatAllowedOffline(mode);
  }, [isOnline]);

  const showDenisFallback = offlineBlocked || recoveryFailureCount >= 2;
  const fallbackLevel = useMemo(() => {
    if (offlineBlocked) return 4 as const;
    return resolveDenisFallbackLevel({
      circuitOpen: recoveryFailureCount >= 3,
      circuitHalfOpen: recoveryFailureCount >= 2,
    });
  }, [offlineBlocked, recoveryFailureCount]);

  const thinkingSteps = useMemo(() => {
    if (chat.serverThinkingSteps.length > 0) return chat.serverThinkingSteps;
    if (!chat.pendingThinkingMessage) return [];
    return resolveDenisThinkingStepKeys(chat.pendingThinkingMessage).map((key) =>
      chat.tChat(key)
    );
  }, [chat.serverThinkingSteps, chat.pendingThinkingMessage, chat.tChat]);

  const thinkingHeadline = useRotatingThinkingLabel(
    thinkingSteps,
    chat.isTyping
  );

  const handleVoiceTranscript = useCallback(
    (transcript: string) => {
      void chat.sendUserMessage(transcript, { inputSurface: "voice" });
    },
    [chat.sendUserMessage]
  );

  const handleSend = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const text = input.trim();
      if (!text || chat.isTyping || chat.phase !== "chat") return;
      setInput("");
      await chat.sendUserMessage(text);
    },
    [input, chat.isTyping, chat.phase, chat.sendUserMessage]
  );

  const handleFallbackBrowseMenu = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const handleFallbackCallWaiter = useCallback(() => {
    void requestGuestWaiterCall({
      tableToken: token,
      sessionToken,
      locationId,
      tableId,
      label: tUI("scene.situation.chipWaiter"),
    });
  }, [token, sessionToken, locationId, tableId, tUI]);

  const handleFallbackOrderStandard = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const inputEnabled = chat.phase === "chat";
  const canSend = inputEnabled && !chat.isTyping && input.trim().length > 0;
  const situationHeadline = sceneChrome?.situation?.headline ?? null;

  return {
    open,
    overlayRef,
    scrollRef,
    footerRef,
    inputRef,
    inputFocused,
    setInputFocused,
    slug,
    token,
    taxPercent,
    currency,
    orderingDisabled,
    onOpenChange,
    tUI,
    tChat: chat.tChat,
    markState: sceneChrome?.markState ?? "idle",
    situationHeadline,
    isTyping: chat.isTyping,
    thinkingHeadline,
    voiceEnabled,
    voice,
    cartAnnouncement,
    welcomeVisible,
    showDenisFallback,
    fallbackLevel,
    menuLocale,
    isReturning,
    chatLanguage: chat.chatLanguage,
    tableName,
    messages: chat.messages,
    addedIds: chat.addedIds,
    phase: chat.phase,
    input,
    setInput,
    canSend,
    inputEnabled,
    handleSend,
    handleVoiceTranscript,
    onWelcomeChipSelect: (text: string) => void chat.sendUserMessage(text),
    scrollToBottom,
    onQuickPickConfirm: chat.handleQuickPickConfirm,
    onQuickReply: chat.handleQuickReply,
    onAddRecommendation: chat.handleAddRecommendation,
    handleFallbackBrowseMenu,
    handleFallbackCallWaiter,
    handleFallbackOrderStandard:
      orderingDisabled ? undefined : handleFallbackOrderStandard,
  };
}
