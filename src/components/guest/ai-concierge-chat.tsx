"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { createPortal } from "react-dom";
import { Send, X } from "lucide-react";
import { DenisChip } from "@/components/design-system/denis-chip";
import {
  DenisMessageBlock,
  DenisMessageThinking,
} from "@/components/design-system/denis-message-block";
import {
  DenisPanel,
  DenisPanelBody,
  DenisPanelFooter,
  DenisPanelHeader,
} from "@/components/design-system/denis-panel";
import { DenisBrandMark } from "@/components/design-system/denis-brand-mark";
import {
  DenisCartHeaderLink,
  DenisCartTiles,
} from "@/components/guest/denis-cart-tiles";
import {
  ProductRecommendationCard,
  type ProductRecommendation,
} from "@/components/guest/product-recommendation-card";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import { resolveAiPromptLanguage, type AI_SUPPORTED_LANGUAGES } from "@/lib/ai/config";
import {
  resolveStickyGuestLanguage,
  tForAiGuestLanguage,
} from "@/lib/ai/guest-language";
import {
  bumpGuestRecoveryFailureCount,
  clearGuestRecoveryFailureCount,
  GuestRecoveryError,
  isInfrastructureChatError,
  resolveGuestRecoveryResponse,
  tryLocalGuestAnswer,
  type GuestRecoveryResult,
} from "@/lib/guest/denis-guest-recovery";
import { requestGuestPaymentHandoff } from "@/lib/guest/request-payment-handoff";
import { requestGuestWaiterCall } from "@/lib/guest/request-waiter-call";
import type { DenisGuestApiMeta } from "@/lib/denis/surfaces/format-denis-api-meta";
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
  legacyTokensForAiSession,
  readAiSessionIdForGuest,
  resolveGuestAiContextToken,
  writeAiSessionIdForGuest,
} from "@/lib/ai/guest-ai-token";
import { useGuestSession } from "@/hooks/use-guest-session";
import {
  completeAiSession,
  trackAiConversion,
} from "@/lib/ai/guest-session-storage";
import {
  getOrCreateDeviceFingerprint,
  getStoredDeviceToken,
} from "@/lib/guest/device-storage";
import {
  applyDenisOrderSessionOpened,
  pollDenisApprovalPin,
  type DenisOrderSubmitPayload,
} from "@/lib/guest/apply-denis-order-submit";
import { recordGuestOrderPlaced } from "@/lib/pwa/install-timing";
import { toastAddedToCart } from "@/lib/cart-toast";
import { hapticClick, hapticSuccess } from "@/lib/haptics";
import type { MenuSection } from "@/lib/menu-section";
import type { AllergenId } from "@/lib/allergens";
import type { GuestMemoryProfile } from "@/lib/guest/guest-memory-storage";
import { postDenisMessageTurn } from "@/lib/guest/denis-signal-client";
import {
  resolveDenisThinkingStepKeys,
  useRotatingThinkingLabel,
} from "@/lib/guest/denis-thinking-steps";
import { transcriptEntriesToChatMessages } from "@/lib/guest/view-transcript-bootstrap";
import { useCart } from "@/hooks/use-cart";
import { useDenisVoice } from "@/hooks/use-denis-voice";
import { DenisVoiceMicButton } from "@/components/guest/denis-voice-mic-button";
import type { SceneSituation } from "@/lib/scene/types";
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
  if (
    status === 410 ||
    error?.includes("no longer active") ||
    error?.includes("message limit")
  ) {
    return tUI("ai.overlay.sessionExpired");
  }
  if (status === 403 && error?.includes("Session does not match")) {
    return tUI("ai.overlay.sessionExpired");
  }
  if (status === 429) {
    return tUI("ai.overlay.rateLimited");
  }
  if (status === 502 || status === 503 || status === 504) {
    return tUI("ai.recovery.connection");
  }
  if (
    error === "signal_timeout" ||
    error === "signal_processing_failed" ||
    error === "signal_failed"
  ) {
    return tUI("ai.recovery.connection");
  }
  return error ?? tUI("ai.overlay.error");
}

function aiLegacySessionTokens(
  tableId: string,
  sessionToken: string | null | undefined
) {
  return legacyTokensForAiSession(
    tableId,
    sessionToken,
    useGuestSession.getState().tableId
  );
}

function isStaleAiSessionResponse(
  status: number,
  error: string | undefined,
  sessionId: string | undefined
) {
  if (!sessionId) return false;
  if (status === 401 || status === 404 || status === 410) return true;
  return (
    error?.includes("no longer active") === true ||
    error?.includes("message limit") === true
  );
}

function nextId() {
  return crypto.randomUUID();
}

function parseStoredAssistantContent(content: string): {
  text: string;
  recommendations?: ProductRecommendation[];
} {
  try {
    const parsed = JSON.parse(content) as {
      message?: string;
      recommendations?: ProductRecommendation[];
    };
    if (typeof parsed.message === "string") {
      return {
        text: parsed.message,
        recommendations: parsed.recommendations,
      };
    }
  } catch {
    // Plain text fallback
  }
  return { text: content };
}

function formatDenisPinMessage(
  tUI: (key: string, vars?: Record<string, string | number>) => string,
  tablePin: string
) {
  return tUI("ai.order.tablePinReveal", { pin: tablePin });
}

function DenisRecommendList({
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
    <div className="mt-4 divide-y divide-[var(--qr-elevated)]/80">
      {recommendations.map((rec) => (
        <ProductRecommendationCard
          key={rec.productId}
          recommendation={rec}
          currency={currency}
          compact
          orderingDisabled={orderingDisabled || addedIds.has(rec.productId)}
          onAddClick={() => onAdd(rec)}
        />
      ))}
    </div>
  );
}

function DenisMessageRow({
  message,
  currency,
  orderingDisabled,
  addedIds,
  onQuickPickConfirm,
  onQuickReply,
  onAddRecommendation,
  continueLabel,
  markState = "idle",
}: {
  message: ChatMessage;
  currency: string;
  orderingDisabled: boolean;
  addedIds: Set<string>;
  onQuickPickConfirm?: (messageId: string, ids: string[]) => void;
  onQuickReply?: (messageId: string, label: string) => void;
  onAddRecommendation: (rec: ProductRecommendation) => void;
  continueLabel: string;
  markState?: "idle" | "listen" | "think";
}) {
  if (message.role === "user") {
    return (
      <DenisMessageBlock role="user">{message.content}</DenisMessageBlock>
    );
  }

  return (
    <DenisMessageBlock role="assistant" markState={markState}>
      <p className="whitespace-pre-wrap text-[15px] leading-[1.65] text-[var(--qr-ivory)]">
        {message.content}
      </p>
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
        <DenisRecommendList
          recommendations={message.recommendations}
          currency={currency}
          orderingDisabled={orderingDisabled}
          addedIds={addedIds}
          onAdd={onAddRecommendation}
        />
      )}
    </DenisMessageBlock>
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
            <DenisChip
              key={option.id}
              label={option.label}
              disabled={confirmed}
              selected={isSelected}
              onClick={() => toggle(option.id)}
            />
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
          className="mt-4 text-sm text-[var(--qr-muted)] transition hover:text-[var(--qr-ivory)] disabled:cursor-not-allowed disabled:opacity-40"
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
        <DenisChip
          key={option}
          label={option}
          disabled={used}
          onClick={() => onSelect(option)}
        />
      ))}
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
  taxPercent: number;
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
  /** @deprecated Welcome-back is shown on the dock subtitle only, not in chat. */
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
  deviceFingerprint?: string;
  /** Premium — location `surfaces.voiceEnabled` (M18). */
  voiceEnabled?: boolean;
  voiceTtsEnabled?: boolean;
  sceneChrome?: {
    tableName: string;
    venueName: string;
    markState: "idle" | "listen" | "think";
    situation?: SceneSituation | null;
  } | null;
  /** ADR-019 Phase B.1 — hydrate desk from view.transcript (order page). */
  bootstrapTranscript?: import("@/lib/denis/loop/view-types").TranscriptEntry[] | null;
  onSceneRefresh?: () => void;
  /** M28 — Denis payment handoff opens session bill sheet. */
  onOpenPaymentSheet?: () => void;
};

export function AiConciergeChat({
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
  onSetupComplete,
  getBrowsingContext,
  scrollContext,
  guestProfile,
  isReturning: _isReturning = false,
  onAddToCart,
  customizableProductIds,
  onOpenProductDetail,
  onRecommendations,
  welcomeBackMessage: _welcomeBackMessage,
  knownAllergySelection,
  onSaveAllergies,
  getManualCartSnapshot,
  deviceFingerprint,
  voiceEnabled = false,
  voiceTtsEnabled = true,
  sceneChrome = null,
  bootstrapTranscript = null,
  onSceneRefresh,
  onOpenPaymentSheet,
}: AiConciergeChatProps) {
  const { tUI, menuLocale, isEnglish } = useAppLocale();
  const defaultLanguage = isEnglish ? "en" : menuLocale;
  const venueGreeting = useMemo(
    () => tForAiGuestLanguage("ai.chat.greeting", menuLocale),
    [menuLocale]
  );
  const [chatLanguage, setChatLanguage] = useState<
    (typeof AI_SUPPORTED_LANGUAGES)[number]
  >(resolveAiPromptLanguage(menuLocale));
  const resolveScrollContext = scrollContext ?? getBrowsingContext;
  const resolvedDeviceFingerprint = useMemo(
    () => deviceFingerprint ?? getOrCreateDeviceFingerprint(),
    [deviceFingerprint]
  );
  const handleRecommendations = onRecommendations ?? onSetupComplete;
  const resolvedAllergySelection =
    guestProfile?.allergySheetIds?.length
      ? guestProfile.allergySheetIds
      : (knownAllergySelection ?? []);
  const addItem = useCart((s) => s.addItem);
  const cartItems = useCart((s) => s.items);
  const clearCart = useCart((s) => s.clearCart);
  const scrollRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatInitKeyRef = useRef<string | null>(null);
  const historyLoadedForRef = useRef<string | null>(null);
  const approvalPollCleanupRef = useRef<(() => void) | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [phase, setPhase] = useState<ChatPhase>("chat");
  const [isTyping, setIsTyping] = useState(false);
  const [pendingThinkingMessage, setPendingThinkingMessage] = useState<
    string | null
  >(null);
  const [input, setInput] = useState("");
  const [inputFocused, setInputFocused] = useState(false);
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
    return () => {
      approvalPollCleanupRef.current?.();
      approvalPollCleanupRef.current = null;
    };
  }, []);

  const tableName = sceneChrome?.tableName ?? "";

  const handleDenisOrderSubmit = useCallback(
    (payload: DenisOrderSubmitPayload) => {
      if (payload.sessionOpened) {
        applyDenisOrderSessionOpened({
          slug,
          tableToken: token,
          locationId,
          tableId,
          tableName,
          sessionOpened: payload.sessionOpened,
        });
      }

      const appendPinMessage = (tablePin: string) => {
        const tPin = (key: string, vars?: Record<string, string | number>) =>
          tForAiGuestLanguage(
            key as Parameters<typeof tForAiGuestLanguage>[0],
            chatLanguage,
            vars
          );
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: "assistant",
            content: formatDenisPinMessage(tPin, tablePin),
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
        tableToken: token,
        slug,
        locationId,
        tableId,
        tableName,
        onPin: appendPinMessage,
        onRejected: (reason) => {
          setMessages((prev) => [
            ...prev,
            {
              id: nextId(),
              role: "assistant",
              content:
                reason ??
                  tForAiGuestLanguage(
                    "session.approvalRejected",
                    chatLanguage
                  ),
            },
          ]);
        },
      });
    },
    [slug, token, locationId, tableId, tableName, chatLanguage]
  );

  useEffect(() => {
    if (!open || isDemo) return;

    const initKey = `${locationId}:${token}`;
    setPhase("chat");

    if (chatInitKeyRef.current === initKey && messages.length > 0) {
      return;
    }

    const viewBootstrap =
      bootstrapTranscript && bootstrapTranscript.length > 0
        ? transcriptEntriesToChatMessages(bootstrapTranscript)
        : null;

    if (messages.length === 0 && !viewBootstrap) {
      setMessages([
        {
          id: nextId(),
          role: "assistant",
          content: venueGreeting,
        },
      ]);
      setChatLanguage(resolveAiPromptLanguage(menuLocale));
    }

    let cancelled = false;

    async function bootstrapChat() {
      if (viewBootstrap?.length) {
        setMessages(
          viewBootstrap.map((entry) => ({
            id: entry.id,
            role: entry.role,
            content: entry.content,
          }))
        );
        setPhase("chat");
        chatInitKeyRef.current = initKey;
        return;
      }

      const storedSessionId =
        aiSessionId ??
        readAiSessionIdForGuest(
          locationId,
          token,
          aiLegacySessionTokens(tableId, sessionToken)
        );

      if (
        storedSessionId &&
        historyLoadedForRef.current === storedSessionId &&
        messages.length > 0
      ) {
        chatInitKeyRef.current = initKey;
        setPhase("chat");
        return;
      }

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

      if (storedSessionId) {
        const aiContextToken = resolveGuestAiContextToken(token, sessionToken);
        if (aiContextToken) {
          try {
            const params = new URLSearchParams({
              sessionId: storedSessionId,
              locationId,
              tableId,
              sessionToken: aiContextToken,
            });
            const controller = new AbortController();
            const historyTimeoutId = window.setTimeout(
              () => controller.abort(),
              5_000
            );
            let res: Response;
            try {
              res = await fetch(`/api/ai/session?${params}`, {
                signal: controller.signal,
              });
            } finally {
              window.clearTimeout(historyTimeoutId);
            }
            if (res.ok) {
              const json = (await res.json()) as {
                data?: {
                  messages: Array<{
                    role: "user" | "assistant";
                    content: string;
                  }>;
                  language?: string;
                };
              };
              const history = json.data?.messages ?? [];
              if (!cancelled && history.length > 0) {
                const hydrated: ChatMessage[] = history.map((entry) => {
                  if (entry.role === "assistant") {
                    const parsed = parseStoredAssistantContent(entry.content);
                    return {
                      id: nextId(),
                      role: "assistant" as const,
                      content: parsed.text,
                      recommendations: parsed.recommendations,
                    };
                  }
                  return {
                    id: nextId(),
                    role: "user" as const,
                    content: entry.content,
                  };
                });
                setMessages(hydrated);
                setPhase("chat");
                setChatLanguage(
                  resolveAiPromptLanguage(json.data?.language ?? menuLocale)
                );
                setAiSessionId(storedSessionId);
                historyLoadedForRef.current = storedSessionId;
                chatInitKeyRef.current = initKey;
                return;
              }
            } else if (
              isStaleAiSessionResponse(res.status, undefined, storedSessionId)
            ) {
              void completeAiSession({
                sessionId: storedSessionId,
                locationId,
                tableId,
                sessionToken: aiContextToken,
              });
              clearAiSessionIdForGuest(
                locationId,
                token,
                aiLegacySessionTokens(tableId, sessionToken)
              );
              if (!cancelled) {
                setAiSessionId(null);
                historyLoadedForRef.current = null;
              }
            }
          } catch {
            // Fall through to greeting for new session UX
          }
        }
      }

      if (cancelled) {
        return;
      }

      setPhase("chat");
      setAiSessionId(null);
      chatInitKeyRef.current = initKey;
    }

    setIsTyping(false);
    setInput("");
    setAddedIds(new Set());
    void bootstrapChat();
    return () => {
      cancelled = true;
    };
  }, [
    open,
    isDemo,
    locationId,
    token,
    sessionToken,
    tableId,
    tUI,
    venueGreeting,
    menuLocale,
    resolvedAllergySelection,
    defaultLanguage,
    aiSessionId,
    messages.length,
    bootstrapTranscript,
  ]);

  const CHAT_FETCH_TIMEOUT_MS = 58_000;
  const recoveryScopeKey = `${locationId}:${token}:${sessionToken ?? "anon"}`;

  const buildRecovery = useCallback(
    (guestMessage: string, failureCount: number, language: string) =>
      resolveGuestRecoveryResponse({
        guestMessage,
        failureCount,
        language,
        situation: sceneChrome?.situation,
        cartItemCount: cartItems.length,
      }),
    [sceneChrome?.situation, cartItems.length]
  );

  const fireRecoveryAction = useCallback(
    async (action: GuestRecoveryResult["action"]) => {
      if (!action) return;
      try {
        if (action.tryPaymentHandoff) {
          const result = await requestGuestPaymentHandoff({
            tableToken: token,
            sessionToken,
            locationId,
            tableId,
            method: action.tryPaymentHandoff,
            label: action.tryPaymentHandoff,
          });
          if (result.openPaymentSheet || action.openPaymentSheet) {
            onOpenPaymentSheet?.();
          }
        } else if (action.tryWaiterCall) {
          await requestGuestWaiterCall({
            tableToken: token,
            sessionToken,
            locationId,
            tableId,
            label: tUI("scene.situation.chipWaiter"),
          });
        }
        onSceneRefresh?.();
      } catch {
        /* guest still sees local narration */
      }
    },
    [
      token,
      sessionToken,
      locationId,
      tableId,
      tUI,
      onSceneRefresh,
      onOpenPaymentSheet,
    ]
  );

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  useEffect(() => {
    if (!open) return;
    scrollToBottom();
  }, [open, inputFocused, scrollToBottom]);

  useEffect(() => {
    if (!open) return;
    document.documentElement.classList.add("denis-chat-open");
    return () => {
      document.documentElement.classList.remove("denis-chat-open");
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setInputFocused(false);
      return;
    }

    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";

    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const overlay = overlayRef.current;
    const viewport = window.visualViewport;
    if (!overlay || !viewport) return;

    const sync = () => {
      overlay.style.setProperty(
        "--denis-vv-offset",
        `${Math.max(0, viewport.offsetTop)}px`
      );
      overlay.style.setProperty("--denis-vv-height", `${viewport.height}px`);
    };

    sync();
    viewport.addEventListener("resize", sync);
    viewport.addEventListener("scroll", sync);
    window.addEventListener("orientationchange", sync);
    return () => {
      viewport.removeEventListener("resize", sync);
      viewport.removeEventListener("scroll", sync);
      window.removeEventListener("orientationchange", sync);
      overlay.style.removeProperty("--denis-vv-offset");
      overlay.style.removeProperty("--denis-vv-height");
    };
  }, [open, inputFocused]);

  useEffect(() => {
    if (!open || !inputFocused) return;
    const timer = window.setTimeout(() => {
      scrollToBottom();
    }, 120);
    return () => window.clearTimeout(timer);
  }, [open, inputFocused, scrollToBottom]);

  const voice = useDenisVoice({
    enabled: voiceEnabled && open,
    language: chatLanguage,
    autoSpeak: voiceTtsEnabled,
  });

  const tChat = useCallback(
    (key: Parameters<typeof tForAiGuestLanguage>[0], vars?: Record<string, string | number>) =>
      tForAiGuestLanguage(key, chatLanguage, vars),
    [chatLanguage]
  );

  const thinkingSteps = useMemo(() => {
    if (!pendingThinkingMessage) return [];
    return resolveDenisThinkingStepKeys(pendingThinkingMessage).map((key) =>
      tChat(key)
    );
  }, [pendingThinkingMessage, tChat]);

  const thinkingHeadline = useRotatingThinkingLabel(thinkingSteps, isTyping);

  const callAiChat = useCallback(
    async (
      message: string,
      prefs?: { allergies: string[]; mood: string },
      retryWithoutSession = false,
      inputSurface: "chat" | "voice" = "chat"
    ) => {
      const aiContextToken = resolveGuestAiContextToken(token, sessionToken);
      if (!aiContextToken) {
        throw new Error(tChat("ai.overlay.unavailable"));
      }

      const legacyTokens = aiLegacySessionTokens(tableId, sessionToken);
      const sessionId = retryWithoutSession
        ? undefined
        : (aiSessionId ??
          readAiSessionIdForGuest(locationId, token, legacyTokens) ??
          undefined);

      const controller = new AbortController();
      const timeoutId = window.setTimeout(
        () => controller.abort(),
        CHAT_FETCH_TIMEOUT_MS
      );

      const requestLanguage = resolveStickyGuestLanguage(
        message,
        menuLocale,
        chatLanguage
      );

      let res: Response;
      try {
        res = await postDenisMessageTurn(
          {
            tableToken: token,
            tableSessionToken: sessionToken ?? undefined,
            locationId,
            tableId,
            message,
            language: requestLanguage,
            aiSessionId: sessionId,
            preferences: prefs ?? preferencesRef.current,
            includeOrderContext: true,
            allowOrdering: !orderingDisabled,
            browsingContext: resolveScrollContext?.() ?? undefined,
            manualCartSnapshot: getManualCartSnapshot?.() ?? undefined,
            deviceFingerprint: resolvedDeviceFingerprint,
            deviceToken: getStoredDeviceToken(locationId, tableId) ?? undefined,
            surface: inputSurface,
          },
          { signal: controller.signal }
        );
      } catch (fetchError) {
        if (fetchError instanceof Error && fetchError.name === "AbortError") {
          const failureCount = bumpGuestRecoveryFailureCount(recoveryScopeKey);
          throw new GuestRecoveryError(
            buildRecovery(message, failureCount, requestLanguage)
          );
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
          voice?: { speakText: string; ttsRecommended: boolean };
          denis?: DenisGuestApiMeta;
          orderSubmit?: DenisOrderSubmitPayload;
          openPaymentSheet?: boolean;
        };
      };

      if (!res.ok) {
        if (
          !retryWithoutSession &&
          isStaleAiSessionResponse(res.status, json.error, sessionId)
        ) {
          if (sessionId) {
            void completeAiSession({
              sessionId,
              locationId,
              tableId,
              sessionToken: aiContextToken,
            });
          }
          clearAiSessionIdForGuest(locationId, token, [
            sessionToken,
            aiContextToken,
            ...legacyTokens,
          ]);
          setAiSessionId(null);
          return callAiChat(message, prefs, true, inputSurface);
        }

        if (isInfrastructureChatError(json.error, res.status)) {
          const failureCount = bumpGuestRecoveryFailureCount(recoveryScopeKey);
          throw new GuestRecoveryError(
            buildRecovery(message, failureCount, requestLanguage)
          );
        }

        throw new Error(
          mapAiChatError(json.error, res.status, json.details, tChat)
        );
      }

      if (!json.data) {
        const failureCount = bumpGuestRecoveryFailureCount(recoveryScopeKey);
        throw new GuestRecoveryError(
          buildRecovery(message, failureCount, requestLanguage)
        );
      }

      const data = json.data;
      clearGuestRecoveryFailureCount(recoveryScopeKey);

      if (data.sessionId) {
        writeAiSessionIdForGuest(locationId, token, data.sessionId);
        setAiSessionId(data.sessionId);
      }

      setChatLanguage(requestLanguage);

      return data;
    },
    [
      token,
      sessionToken,
      aiSessionId,
      locationId,
      menuLocale,
      chatLanguage,
      tableId,
      tChat,
      resolveScrollContext,
      orderingDisabled,
      getManualCartSnapshot,
      resolvedDeviceFingerprint,
      recoveryScopeKey,
      buildRecovery,
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

  const sendUserMessage = useCallback(
    async (
      text: string,
      options?: { inputSurface?: "chat" | "voice" }
    ) => {
      const trimmed = text.trim();
      if (!trimmed || isTyping || phase !== "chat") return;
      const inputSurface = options?.inputSurface ?? "chat";

      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: "user", content: trimmed },
      ]);
      setPendingThinkingMessage(trimmed);
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

        const localAnswer = tryLocalGuestAnswer({
          guestMessage: trimmed,
          language: chatLanguage,
          situation: sceneChrome?.situation,
          cartItemCount: cartItems.length,
        });
        if (localAnswer?.answeredLocally) {
          setMessages((prev) => [
            ...prev,
            {
              id: nextId(),
              role: "assistant",
              content: localAnswer.message,
              quickReplies: localAnswer.quickReplies,
            },
          ]);
          void fireRecoveryAction(localAnswer.action);
          return;
        }

        const data = await callAiChat(trimmed, undefined, false, inputSurface);
        applyCartActions(data.cartActions);

        if (data.orderSubmit) {
          clearCart();
          hapticSuccess();
          recordGuestOrderPlaced();
          handleDenisOrderSubmit(data.orderSubmit);
        }

        if (data.openPaymentSheet) {
          onOpenPaymentSheet?.();
        }

        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: "assistant",
            content: data.message,
            quickReplies: data.quickReplies?.length
              ? data.quickReplies
              : undefined,
            recommendations: data.recommendations?.length
              ? data.recommendations
              : undefined,
          },
        ]);

        if (
          inputSurface === "voice" &&
          data.voice?.ttsRecommended &&
          data.voice.speakText
        ) {
          voice.speak(data.voice.speakText);
        }
      } catch (err) {
        const recovery =
          err instanceof GuestRecoveryError
            ? err.recovery
            : buildRecovery(
                trimmed,
                bumpGuestRecoveryFailureCount(recoveryScopeKey),
                chatLanguage
              );

        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: "assistant",
            content: recovery.message,
            quickReplies: recovery.quickReplies,
          },
        ]);
        void fireRecoveryAction(recovery.action);
      } finally {
        setIsTyping(false);
        setPendingThinkingMessage(null);
        onSceneRefresh?.();
      }
    },
    [
      isTyping,
      phase,
      isDemo,
      menuCategories,
      sceneChrome?.situation,
      cartItems.length,
      fireRecoveryAction,
      buildRecovery,
      callAiChat,
      recoveryScopeKey,
      chatLanguage,
      applyCartActions,
      clearCart,
      tChat,
      voice,
      onSceneRefresh,
      onOpenPaymentSheet,
      handleDenisOrderSubmit,
      recordGuestOrderPlaced,
    ]
  );

  const handleVoiceTranscript = useCallback(
    (transcript: string) => {
      void sendUserMessage(transcript, { inputSurface: "voice" });
    },
    [sendUserMessage]
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
  const situationHeadline = sceneChrome?.situation?.headline ?? null;

  const overlay = (
    <div
      ref={overlayRef}
      className={cn(
        "guest-theme denis-chat-overlay sm:justify-end sm:bg-black/70",
        inputFocused && "denis-chat-overlay--keyboard"
      )}
    >
      <DenisPanel
        className={cn(
          "denis-chat-panel relative mx-0 mb-0 h-full min-h-0 max-h-full flex-1 rounded-none sm:mx-3 sm:mb-3 sm:h-auto sm:max-h-[min(88dvh,720px)] sm:w-auto sm:flex-none sm:rounded-2xl before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:z-10 before:h-0.5 before:bg-[var(--qr-ember)] before:content-['']"
        )}
      >
        <DenisPanelHeader
          className={cn(
            "relative shrink-0 border-b border-[var(--qr-elevated)]",
            inputFocused ? "gap-2 py-2 pt-3" : "pt-5"
          )}
        >
          <div className="min-w-0 flex-1 overflow-hidden">
            <DenisBrandMark
              markSize={24}
              markState={
                isTyping
                  ? "think"
                  : voice.listening
                    ? "listen"
                    : sceneChrome?.markState ?? "idle"
              }
              className="max-w-full [&_.text-dash-text-muted]:text-[var(--qr-muted)] [&_.text-dash-text]:text-[var(--qr-ivory)]"
            />
            {(thinkingHeadline || situationHeadline) && !inputFocused ? (
              <p className="mt-1 line-clamp-1 text-[12px] text-[var(--qr-muted)]">
                {thinkingHeadline ?? situationHeadline}
              </p>
            ) : null}
          </div>
          {!orderingDisabled && !inputFocused ? (
            <DenisCartHeaderLink
              slug={slug}
              token={token}
              taxPercent={taxPercent}
              currency={currency}
            />
          ) : null}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="touch-target inline-flex size-9 shrink-0 items-center justify-center text-[var(--qr-muted)] transition hover:text-[var(--qr-ivory)]"
            aria-label={tUI("ai.chat.close")}
          >
            <X className="size-5" strokeWidth={1.5} />
          </button>
        </DenisPanelHeader>

        <DenisPanelBody ref={scrollRef}>
          {messages.map((message, index) => (
            <DenisMessageRow
              key={message.id}
              message={message}
              currency={currency}
              orderingDisabled={orderingDisabled}
              addedIds={addedIds}
              continueLabel={tUI("ai.chat.continue")}
              markState={
                isTyping && index === messages.length - 1 && message.role === "assistant"
                  ? "think"
                  : "idle"
              }
              onQuickPickConfirm={
                message.quickPicks && !message.quickPicks.confirmed
                  ? handleQuickPickConfirm
                  : undefined
              }
              onQuickReply={phase === "chat" ? handleQuickReply : undefined}
              onAddRecommendation={handleAddRecommendation}
            />
          ))}
          {isTyping &&
          (messages.length === 0 ||
            messages[messages.length - 1]?.role === "user") ? (
            <DenisMessageThinking label={thinkingHeadline} />
          ) : null}
        </DenisPanelBody>

        <DenisPanelFooter
          ref={footerRef}
          className="w-full min-w-0 max-w-full shrink-0 overflow-hidden border-t border-[var(--qr-elevated)] bg-[var(--qr-void)] !px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] sm:!px-3"
        >
          <form onSubmit={handleSend} className="w-full min-w-0 max-w-full">
            <div className="denis-chat-input-row flex w-full min-w-0 max-w-full items-center gap-1.5 rounded-full border border-[var(--qr-elevated)] bg-[var(--qr-surface)] px-2 py-1.5">
              {voiceEnabled && !inputFocused && (
                <DenisVoiceMicButton
                  listening={voice.listening}
                  supported={voice.supported}
                  disabled={!inputEnabled || isTyping}
                  listenLabel={tUI("ai.voice.listen")}
                  listeningLabel={tUI("ai.voice.listening")}
                  unsupportedLabel={tUI("ai.voice.unsupported")}
                  onPressStart={() => voice.startListening(handleVoiceTranscript)}
                  onPressEnd={() => voice.stopListening()}
                />
              )}
              <input
                ref={inputRef}
                type="text"
                enterKeyHint="send"
                inputMode="text"
                autoComplete="off"
                autoCorrect="on"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onFocus={() => {
                  setInputFocused(true);
                  scrollToBottom();
                }}
                onBlur={() => setInputFocused(false)}
                disabled={!inputEnabled}
                placeholder={tChat("ai.chat.askDenis")}
                className="min-h-0 min-w-0 flex-1 border-0 bg-transparent py-2 text-base text-[var(--qr-ivory)] placeholder:text-[var(--qr-muted)] outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!canSend}
                aria-label={tUI("ai.chat.send")}
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--qr-ember)] text-white transition disabled:opacity-30"
              >
                <Send className="size-3.5" strokeWidth={1.5} />
              </button>
            </div>
          </form>
        </DenisPanelFooter>
      </DenisPanel>
    </div>
  );

  return createPortal(overlay, document.body);
}
